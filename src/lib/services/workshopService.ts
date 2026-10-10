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
 * 相談: 人の発言に AI が答え、必要なら構成の指示の修正案を出す（下書きに反映する）。
 * 試作: 下書きの構成案で台本を1本だけ書かせ、画面で映像としてプレビューする（音声なし）。
 * AI の発言は pending で作り、別プロセス（agent/workshop-runner.ts）が埋める。画面は数秒ごとに読み直す。
 */

export type SampleScript = { title: string; lines: ScriptLine[] };

// ---------- 開始・発言 ----------

export async function startWorkshop(accountId: string, baseTemplateId: string | null) {
  const base = baseTemplateId ? await prisma.structureTemplate.findUnique({ where: { id: baseTemplateId } }) : null;
  return prisma.templateWorkshop.create({
    data: {
      accountId,
      baseTemplateId: base?.id ?? null,
      name: base ? base.name : '新しい構成案',
      description: base?.description ?? null,
      // 新しく作る場合も、既定の構成案をたたき台にする（白紙より相談しやすい）
      body: base?.body ?? DEFAULT_TEMPLATE.body,
    },
  });
}

/** AI が作業中の発言があるか（同時に1つまで） */
export async function workshopBusy(workshopId: string): Promise<boolean> {
  return (await prisma.templateWorkshopMessage.count({ where: { workshopId, status: 'pending' } })) > 0;
}

export async function postChat(workshopId: string, text: string) {
  await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'user', kind: 'chat', content: text } });
  const reply = await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'assistant', kind: 'chat', status: 'pending' } });
  launchRunner(reply.id);
}

export async function postSample(workshopId: string, topic: string) {
  await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'user', kind: 'sample', content: `試作: ${topic}`, sampleTopic: topic } });
  const reply = await prisma.templateWorkshopMessage.create({ data: { workshopId, role: 'assistant', kind: 'sample', sampleTopic: topic, status: 'pending' } });
  launchRunner(reply.id);
}

function launchRunner(messageId: string) {
  // 画面の応答を待たせないよう、別プロセスで AI を呼ぶ
  spawn('npx', ['tsx', 'agent/workshop-runner.ts', messageId], { cwd: process.cwd(), detached: true, stdio: 'ignore' }).unref();
}

// ---------- AI を呼ぶ（agent/workshop-runner.ts から） ----------

export async function runWorkshopMessage(messageId: string): Promise<void> {
  const message = await prisma.templateWorkshopMessage.findUnique({
    where: { id: messageId },
    include: { workshop: { include: { account: true, messages: { orderBy: { createdAt: 'asc' } } } } },
  });
  if (!message || message.status !== 'pending') return;
  const { workshop } = message;

  try {
    if (message.kind === 'chat') {
      const out = await runClaudeJson<{ reply: string; revisedBody: string | null }>(SYSTEM_PROMPT, chatPrompt(workshop, message.id), CHAT_SCHEMA);
      const revised = out.revisedBody?.trim() ? out.revisedBody.trim().slice(0, TEMPLATE_LIMITS.body) : null;
      await prisma.$transaction([
        prisma.templateWorkshopMessage.update({ where: { id: message.id }, data: { status: 'done', content: out.reply, proposedBody: revised } }),
        ...(revised ? [prisma.templateWorkshop.update({ where: { id: workshop.id }, data: { body: revised } })] : []),
      ]);
    } else {
      const topic = message.sampleTopic ?? '';
      const research = await prisma.trendResearch.findFirst({ where: { accountId: workshop.accountId, topic } });
      const out = await runClaudeJson<SampleScript & { note: string }>(SYSTEM_PROMPT, samplePrompt(workshop, topic, research), SAMPLE_SCHEMA);
      const error = validateScriptLines(out.lines);
      if (error) throw new Error(`台本の形が正しくありませんでした（${error}）。もう一度試作してください`);
      await prisma.templateWorkshopMessage.update({
        where: { id: message.id },
        data: { status: 'done', content: out.note, sampleJson: JSON.stringify({ title: out.title, lines: out.lines }) },
      });
    }
  } catch (error) {
    await prisma.templateWorkshopMessage.update({
      where: { id: message.id },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
    });
  }
}

// ---------- プロンプト ----------

const SYSTEM_PROMPT = [
  'あなたは YouTube ショート動画の「構成案」を、運用担当者と一緒に作る相談相手です。日本語で、短く具体的に答えます。',
  '返事は画面にそのまま表示されるため、マークダウンの強調（** や #）は使いません。箇条書きは「- 」だけを使います。',
  '構成案とは、AI が台本を書くときに従う「型」の指示です（尺・行数・流れ・各行でどの場面を使うか・表情の付け方など）。箇条書きで書きます。',
  '構成案に書かないもの: 使えるコマンド、作業手順、事実と出典のルール、禁止事項。これらは別に固定で渡されるため、構成案に入れる必要はありません。',
  '動画は縦型（9:16）で、1行 = 読み上げ1回 = 字幕1枚。字幕は \\n 区切りの1行が全角13字程度までです。',
].join('\n');

type WorkshopWithContext = {
  name: string;
  body: string;
  account: { name: string; concept: string; targetAudience: string; toneOfVoice: string; systemPromptRules: string | null };
  messages: { id: string; role: string; kind: string; content: string; sampleJson: string | null; status: string }[];
};

function sceneTypesSource(): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'remotion/types.ts'), 'utf-8');
}

function channelSection(w: WorkshopWithContext): string {
  return [
    `## チャンネル「${w.account.name}」`,
    `- コンセプト: ${w.account.concept}`,
    `- 視聴者: ${w.account.targetAudience}`,
    `- 話し方: ${w.account.toneOfVoice}`,
    `- 台本のルール: ${w.account.systemPromptRules || '（なし）'}`,
  ].join('\n');
}

// これまでのやりとり（直近20件）。試作は題名と台本を載せ、「3行目が…」のような相談に答えられるようにする
function historySection(w: WorkshopWithContext, untilId: string): string {
  const past = w.messages.filter((m) => m.id !== untilId && m.status === 'done').slice(-20);
  if (past.length === 0) return '## これまでのやりとり\n（まだありません）';
  const lines = past.map((m) => {
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

function chatPrompt(w: WorkshopWithContext, replyId: string): string {
  const last = [...w.messages].reverse().find((m) => m.role === 'user' && m.kind === 'chat');
  return [
    channelSection(w),
    `## 今の構成案の下書き「${w.name}」\n${w.body}`,
    historySection(w, replyId),
    `## 担当者の今回の発言\n${last?.content ?? ''}`,
    '## 答え方',
    '- reply: 担当者への返事。何をどう変えたか（または変えない理由）を短く。必要なら質問してよい。',
    '- revisedBody: 構成案を直すときは、直した後の全文（箇条書き）。直さないときは null。担当者が変更を求めたら必ず全文を返す。',
    `- 使える場面（scene.type）は ${SCENE_TYPES.join(' / ')}、表情（mood）は ${MOODS.join(' / ')}。これ以外を構成案に書かない。`,
  ].join('\n\n');
}

function samplePrompt(
  w: WorkshopWithContext,
  topic: string,
  research: { suggestedAngle: string; summary: string | null; sourcesJson: string | null } | null
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

const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    revisedBody: { type: ['string', 'null'] },
  },
  required: ['reply', 'revisedBody'],
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

// ---------- 保存 ----------

/** 下書きを構成案として保存する。overwrite なら元の構成案を上書き、そうでなければ新しく作る */
export async function saveWorkshop(workshopId: string, overwrite: boolean): Promise<string> {
  const w = await prisma.templateWorkshop.findUniqueOrThrow({ where: { id: workshopId } });
  const data = { name: w.name, description: w.description, body: w.body };
  const template =
    overwrite && w.baseTemplateId
      ? await prisma.structureTemplate.update({ where: { id: w.baseTemplateId }, data })
      : await prisma.structureTemplate.create({ data });
  await prisma.templateWorkshop.update({ where: { id: w.id }, data: { savedTemplateId: template.id } });
  return template.id;
}
