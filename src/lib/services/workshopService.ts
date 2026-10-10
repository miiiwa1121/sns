import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import { runClaudeJson } from '@/lib/claude';
import { validateScriptLines, type ScriptLine } from '@/lib/script';
import { MOODS, SCENE_TYPES } from '../../../remotion/types';
import { DEFAULT_TEMPLATE, TEMPLATE_LIMITS } from '@/lib/services/templateService';

/**
 * 構成案を AI と相談しながら作る（管理画面の「構成案」→「AI と相談して作る」）。
 * 相談を始めた時点で構成案を作り（名前がなければ sample1, sample2 …）、名前の変更や AI の修正はその構成案に直接保存する。
 * 既存の構成案を改善するときは複製（「◯◯ のコピー」）を作って直す。その構成案が相談から生まれたものなら、前の相談を開き直す。
 * 相談: 人の発言に AI が答え、必要なら構成の指示の修正案を出す（構成案に保存する）。発言から試作を頼まれたら、続けて試作する。
 * 試作: 下書きの構成案で台本を1本だけ書かせ、画面で映像としてプレビューする（音声なし）。
 * AI の発言は pending で作り、別プロセス（agent/workshop-runner.ts）が埋める。画面は数秒ごとに読み直す。
 * 作業中は停止できる（別プロセスのプロセスグループごと止める）。
 */

export type SampleScript = { title: string; lines: ScriptLine[] };

// ---------- 開始・発言・停止 ----------

export async function startWorkshop(accountId: string, baseTemplateId: string | null) {
  const base = baseTemplateId ? await prisma.structureTemplate.findUnique({ where: { id: baseTemplateId } }) : null;
  // 相談から生まれた構成案なら、新しく作らずに前の相談を開き直す
  if (base) {
    const owned = await prisma.templateWorkshop.findFirst({ where: { templateId: base.id }, orderBy: { updatedAt: 'desc' } });
    if (owned) return owned;
  }
  const names = new Set((await prisma.structureTemplate.findMany({ select: { name: true } })).map((t) => t.name));
  const template = await prisma.structureTemplate.create({
    data: {
      name: base ? copyName(base.name, names) : sampleName(names),
      description: base?.description ?? null,
      // 新しく作る場合も、既定の構成案をたたき台にする（白紙より相談しやすい）
      body: base?.body ?? DEFAULT_TEMPLATE.body,
    },
  });
  return prisma.templateWorkshop.create({ data: { accountId, templateId: template.id, baseTemplateId: base?.id ?? null } });
}

// 名前のない新しい構成案は sample1, sample2 …（使われていない最小の番号）
function sampleName(names: Set<string>): string {
  let n = 1;
  while (names.has(`sample${n}`)) n++;
  return `sample${n}`;
}

// 複製は「◯◯ のコピー」。同じ名前があれば「◯◯ のコピー 2」…
function copyName(name: string, names: Set<string>): string {
  const base = `${name} のコピー`.slice(0, TEMPLATE_LIMITS.name);
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** 相談の名前を変える（= 構成案の名前を変える） */
export async function renameWorkshopTemplate(workshopId: string, name: string) {
  const w = await prisma.templateWorkshop.findUniqueOrThrow({ where: { id: workshopId } });
  await prisma.structureTemplate.update({ where: { id: w.templateId }, data: { name } });
}

/** AI が作業中の発言があるか（同時に1つまで） */
export async function workshopBusy(workshopId: string): Promise<boolean> {
  return (await prisma.templateWorkshopMessage.count({ where: { workshopId, status: 'pending' } })) > 0;
}

export async function postChat(workshopId: string, text: string) {
  await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'user', kind: 'chat', content: text } });
  const reply = await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'assistant', kind: 'chat', status: 'pending' } });
  await launchRunner(reply.id);
}

/** ヘッダーの「試作する」。話題は前回の試作と同じもの（なければアカウントの最新のリサーチ） */
export async function postSample(workshopId: string) {
  const topic = await defaultSampleTopic(workshopId);
  await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'user', kind: 'sample', content: `試作: ${topic}`, sampleTopic: topic } });
  const reply = await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'assistant', kind: 'sample', sampleTopic: topic, status: 'pending' } });
  await launchRunner(reply.id);
}

const FALLBACK_TOPIC = '（おまかせ）チャンネルのコンセプトに合う、最近の AI・IT の話題';

async function defaultSampleTopic(workshopId: string): Promise<string> {
  const last = await prisma.templateWorkshopMessage.findFirst({
    where: { workshopId, kind: 'sample', role: 'assistant', sampleTopic: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (last?.sampleTopic) return last.sampleTopic;
  const workshop = await prisma.templateWorkshop.findUniqueOrThrow({ where: { id: workshopId } });
  const research = await prisma.trendResearch.findFirst({ where: { accountId: workshop.accountId }, orderBy: { createdAt: 'desc' } });
  return research?.topic ?? FALLBACK_TOPIC;
}

async function launchRunner(messageId: string) {
  // 画面の応答を待たせないよう、別プロセスで AI を呼ぶ。detached で独立したプロセスグループにし、停止のときにまとめて止める。
  // pid にはグループの先頭（ここで起動した npx）の番号を記録する（runner の中の process.pid は子のため、グループ番号と違う）
  const child = spawn('npx', ['tsx', 'agent/workshop-runner.ts', messageId], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  child.unref();
  if (child.pid) await prisma.templateWorkshopMessage.update({ where: { id: messageId }, data: { pid: child.pid } });
}

/** 作業中の AI を止める。止めた発言は canceled にする */
export async function stopWorkshop(workshopId: string): Promise<number> {
  const pending = await prisma.templateWorkshopMessage.findMany({ where: { workshopId, status: 'pending' } });
  for (const m of pending) {
    if (m.pid) {
      try {
        // プロセスグループごと（runner と、そこから起動した Claude Code）止める
        process.kill(-m.pid, 'SIGTERM');
      } catch {
        // すでに終わっている
      }
    }
    await prisma.templateWorkshopMessage.update({ where: { id: m.id }, data: { status: 'canceled', content: '停止しました', pid: null } });
  }
  return pending.length;
}

// ---------- AI を呼ぶ（agent/workshop-runner.ts から） ----------

async function stillPending(messageId: string): Promise<boolean> {
  return (await prisma.templateWorkshopMessage.findUnique({ where: { id: messageId } }))?.status === 'pending';
}

async function loadForRun(messageId: string) {
  return prisma.templateWorkshopMessage.findUnique({
    where: { id: messageId },
    include: { workshop: { include: { account: true, template: true, messages: { orderBy: { createdAt: 'asc' } } } } },
  });
}

/** プロンプトに使う形（構成案の名前・構成の指示を相談に重ねる） */
export function workshopContext<W extends { template: { name: string; body: string } }>(w: W): W & { name: string; body: string } {
  return { ...w, name: w.template.name, body: w.template.body };
}

export async function runWorkshopMessage(messageId: string): Promise<void> {
  const message = await loadForRun(messageId);
  if (!message || message.status !== 'pending') return;
  const workshop = workshopContext(message.workshop);

  try {
    if (message.kind === 'chat') {
      const out = await runClaudeJson<ChatAnswer>(SYSTEM_PROMPT, chatPrompt(workshop, latestUserText(workshop)), CHAT_SCHEMA);
      // 待っている間に停止されていたら、結果は捨てる
      if (!(await stillPending(message.id))) return;
      const revised = out.revisedBody?.trim() ? out.revisedBody.trim().slice(0, TEMPLATE_LIMITS.body) : null;
      await prisma.$transaction([
        prisma.templateWorkshopMessage.update({ where: { id: message.id }, data: { status: 'done', content: out.reply, proposedBody: revised, pid: null } }),
        // 構成案に直接保存する
        ...(revised ? [prisma.structureTemplate.update({ where: { id: workshop.templateId }, data: { body: revised } })] : []),
      ]);
      // 発言の中で試作を頼まれたら、続けて試作する（同じプロセスで）
      if (out.sampleTopic !== null) {
        const topic = out.sampleTopic.trim() || (await defaultSampleTopic(workshop.id));
        const sample = await prisma.templateWorkshopMessage.create({
          // 同じプロセスで続けるので、停止に使うプロセスグループも引き継ぐ
          data: { workshopId: workshop.id, role: 'assistant', kind: 'sample', sampleTopic: topic, status: 'pending', pid: message.pid },
        });
        await runWorkshopMessage(sample.id);
      }
    } else {
      const topic = message.sampleTopic ?? FALLBACK_TOPIC;
      const research = await prisma.trendResearch.findFirst({ where: { accountId: workshop.accountId, topic } });
      const out = await runClaudeJson<SampleScript & { note: string }>(SYSTEM_PROMPT, samplePrompt(workshop, topic, research), SAMPLE_SCHEMA);
      if (!(await stillPending(message.id))) return;
      const error = validateScriptLines(out.lines);
      if (error) throw new Error(`台本の形が正しくありませんでした（${error}）。もう一度試作してください`);
      await prisma.templateWorkshopMessage.update({
        where: { id: message.id },
        data: { status: 'done', content: out.note, sampleJson: JSON.stringify({ title: out.title, lines: out.lines }), pid: null },
      });
    }
  } catch (error) {
    if (!(await stillPending(message.id))) return;
    await prisma.templateWorkshopMessage.update({
      where: { id: message.id },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error), pid: null },
    });
  }
}

// ---------- プロンプト ----------

export const SYSTEM_PROMPT = [
  'あなたは YouTube ショート動画の「構成案」を、運用担当者と一緒に作る相談相手です。日本語で、短く具体的に答えます。',
  '返事は画面にそのまま表示されるため、マークダウンの強調（** や #）は使いません。箇条書きは「- 」だけを使います。',
  '構成案とは、AI が台本を書くときに従う「型」の指示です（尺・行数・流れ・各行でどの場面を使うか・表情の付け方・話し方・台本のルールなど）。箇条書きで書きます。',
  '構成案に書かないもの: 使えるコマンド、作業手順、事実と出典のルール、禁止事項。これらは別に固定で渡されるため、構成案に入れる必要はありません。',
  '動画は縦型（9:16）で、1行 = 読み上げ1回 = 字幕1枚。字幕は \\n 区切りの1行が全角13字程度までです。',
].join('\n');

type ChatAnswer = { reply: string; revisedBody: string | null; sampleTopic: string | null };

type WorkshopWithContext = {
  name: string;
  body: string;
  account: { name: string; concept: string; targetAudience: string };
  messages: { id: string; role: string; kind: string; content: string; sampleJson: string | null; status: string }[];
};

function sceneTypesSource(): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'remotion/types.ts'), 'utf-8');
}

function latestUserText(w: WorkshopWithContext): string {
  return [...w.messages].reverse().find((m) => m.role === 'user' && m.kind === 'chat')?.content ?? '';
}

function channelSection(w: WorkshopWithContext): string {
  return [
    `## チャンネル「${w.account.name}」`,
    `- コンセプト: ${w.account.concept}`,
    `- 視聴者: ${w.account.targetAudience}`,
  ].join('\n');
}

// これまでのやりとり（直近20件。作業中・停止したものは除く）。試作は題名と台本を載せ、「3行目が…」のような相談に答えられるようにする
function historySection(w: WorkshopWithContext, latestText: string): string {
  const past = w.messages.filter((m) => m.status === 'done');
  // 今回の発言は別の節に出すので、履歴からは外す
  const lastIndex = past.map((m) => m.role === 'user' && m.kind === 'chat' && m.content === latestText).lastIndexOf(true);
  const history = (lastIndex >= 0 ? past.filter((_, i) => i !== lastIndex) : past).slice(-20);
  if (history.length === 0) return '## これまでのやりとり\n（まだありません）';
  const lines = history.map((m) => {
    const who = m.role === 'user' ? '担当者' : 'あなた';
    if (m.kind === 'sample' && m.role === 'assistant' && m.sampleJson) {
      const s = safeJson<SampleScript>(m.sampleJson, { title: '', lines: [] });
      const script = s.lines.map((l, i) => `  ${i + 1}. [${l.scene?.type ?? '（継続）'}${l.mood ? `/${l.mood}` : ''}] ${(l.caption ?? l.text).replace(/\n/g, ' ')}`).join('\n');
      return `${who}（試作「${s.title}」）: ${m.content}\n${script}`;
    }
    return `${who}: ${m.content}`;
  });
  return `## これまでのやりとり\n${lines.join('\n\n')}`;
}

/** 相談のプロンプト。latestText は担当者の今回の発言 */
export function chatPrompt(w: WorkshopWithContext, latestText: string): string {
  return [
    channelSection(w),
    `## 今の構成案の下書き「${w.name}」\n${w.body}`,
    historySection(w, latestText),
    `## 担当者の今回の発言\n${latestText}`,
    '## 答え方',
    '- reply: 担当者への返事。何をどう変えたか（または変えない理由）を短く。必要なら質問してよい。',
    '- revisedBody: 構成案を直すときは、直した後の全文（箇条書き）。直さないときは null。担当者が変更を求めたら必ず全文を返す。',
    '- sampleTopic: 担当者が試作（試しに作る・見てみたい・作ってみて など）を求めたら、試作の話題を書く。話題の指定がなければ空文字（前回と同じ話題で試作する）。試作を求めていなければ null。試作は直した後の構成案で行う。',
    `- 使える場面（scene.type）は ${SCENE_TYPES.join(' / ')}、表情（mood）は ${MOODS.join(' / ')}。これ以外を構成案に書かない。`,
  ].join('\n\n');
}

/** 試作のプロンプト */
export function samplePrompt(
  w: WorkshopWithContext,
  topic: string,
  research: { suggestedAngle: string; summary: string | null } | null
): string {
  const facts = research
    ? `## 話題のリサーチ（事実はこの範囲だけで書く）\n- 切り口: ${research.suggestedAngle}\n- 要約: ${research.summary ?? '（なし）'}`
    : '## 話題について\n試作なので Web では調べません。事実は一般に知られている範囲にとどめ、数字・日付・固有の仕様は作らないでください（分からなければぼかす）。';
  return [
    channelSection(w),
    `## 構成案「${w.name}」（この型どおりに台本を書く）\n${w.body}`,
    `## 試作の話題\n${topic}`,
    facts,
    historySection(w, ''),
    '## 場面の型定義（scene の各項目はこの型に合わせる）',
    '```ts\n' + sceneTypesSource() + '\n```',
    '## 答え方',
    '- title: 動画の題名（画面上部に出る。30字程度まで）。',
    '- lines: 台本。構成案の尺・行数・流れに従う。1行目には必ず scene を付ける。scene を付けない行は直前の場面を引き継ぐ。',
    '- 各行: text（読み上げ。読み間違えやすい英語はカタカナ）、caption（字幕。\\n で改行、1行全角13字程度まで）、emphasis（字幕内で強調する語）、scene、mood。',
    '- 絵文字は使わない。特定の企業・人物を応援・批判しない。',
    '- note: 構成案のどこをどう台本に反映したか、試作して気づいた構成案の改善点を1〜3文で。',
  ].join('\n\n');
}

/** 画面の左の列に出す、実際に AI に渡すプロンプト（今の下書き・会話の状態で組み立てる） */
export async function promptsForDisplay(w: WorkshopWithContext & { accountId: string; id: string }) {
  const topic = await defaultSampleTopic(w.id);
  const research = await prisma.trendResearch.findFirst({ where: { accountId: w.accountId, topic } });
  return {
    sample: samplePrompt(w, topic, research),
    chat: chatPrompt(w, '（ここに、次に送る相談の内容が入ります）'),
  };
}

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    revisedBody: { type: ['string', 'null'] },
    sampleTopic: { type: ['string', 'null'] },
  },
  required: ['reply', 'revisedBody', 'sampleTopic'],
};

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    note: { type: 'string' },
    lines: {
      type: 'array',
      minItems: 1,
      maxItems: 30,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          caption: { type: 'string' },
          emphasis: { type: 'array', items: { type: 'string' } },
          mood: { type: 'string', enum: MOODS },
          scene: { type: 'object', properties: { type: { type: 'string', enum: SCENE_TYPES } }, required: ['type'] },
        },
        required: ['text'],
      },
    },
  },
  required: ['title', 'note', 'lines'],
};
