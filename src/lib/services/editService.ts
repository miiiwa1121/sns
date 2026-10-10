import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import { runAiJson } from '@/lib/ai/providers';
import { EDIT_SCHEMA } from '@/lib/ai/schemas';
import { validateScriptLines, type ScriptLine } from '@/lib/script';
import { projectWorkDir } from '@/lib/storage';

/**
 * 動画編集画面（/projects/[id]/edit）。台本を手で直す・AI に直してもらう・音声つきの動画を作り直す。
 * 投稿済みの企画は直せない（YouTube の動画と食い違うため）。作業中の依頼（AI エージェント）がある企画も直せない。
 * 作り直しと AI の手直しは別プロセス（agent/render-runner.ts / agent/edit-runner.ts）で動かし、プロセスグループごと止められる。
 */

export const TITLE_MAX = 60;

/** 直せない理由（直せるなら null） */
export async function editBlockedReason(projectId: string): Promise<string | null> {
  const published = await prisma.publishLog.count({ where: { projectId, status: 'published' } });
  if (published > 0) return '投稿済みの動画は直せません（YouTube の動画と食い違うため）';
  const job = await prisma.agentJob.count({ where: { projectId, status: 'running' } });
  if (job > 0) return 'AI が作業中の依頼があります。終わってから直してください';
  return null;
}

async function clipOf(projectId: string) {
  const clip = await prisma.shortClip.findFirst({ where: { projectId } });
  if (!clip) throw new Error('この企画には台本がありません');
  return clip;
}

/** 台本と動画のタイトルを保存する（動画は作り直すまで前のまま） */
export async function saveScript(projectId: string, title: string, lines: ScriptLine[]): Promise<string | null> {
  const blocked = await editBlockedReason(projectId);
  if (blocked) return blocked;
  const t = title.trim();
  if (!t || t.length > TITLE_MAX) return `タイトルは1〜${TITLE_MAX}文字で入力してください`;
  const error = validateScriptLines(lines);
  if (error) return error;
  const clip = await clipOf(projectId);
  if (clip.renderStatus === 'rendering') return '動画を作り直している途中です。終わるか止めてから保存してください';
  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { title: t } }),
    prisma.shortClip.update({
      where: { id: clip.id },
      data: { title: t, scriptJson: JSON.stringify(lines), hookSentence: lines[0].caption ?? lines[0].text },
    }),
  ]);
  return null;
}

// ---------- 動画の作り直し ----------

export function produceLogPath(projectId: string): string {
  return path.join(projectWorkDir(projectId), 'produce.log');
}

/** 作り直しを始める（保存済みの台本で、音声合成 → レンダリング） */
export async function startRender(projectId: string): Promise<string | null> {
  const blocked = await editBlockedReason(projectId);
  if (blocked) return blocked;
  const clip = await clipOf(projectId);
  if (clip.renderStatus === 'rendering') return 'すでに作り直しています';
  if (await prisma.projectEditMessage.count({ where: { projectId, status: 'pending' } })) return 'AI が台本を直している途中です。終わるか止めてから作り直してください';
  // 音声合成とレンダリングは重いため、全体で同時に1本まで
  const other = await prisma.shortClip.count({ where: { renderStatus: 'rendering' } });
  if (other > 0) return 'ほかの動画を作り直している途中です。終わってから作り直してください';

  fs.mkdirSync(projectWorkDir(projectId), { recursive: true });
  fs.writeFileSync(produceLogPath(projectId), '');
  await prisma.shortClip.update({ where: { id: clip.id }, data: { renderStatus: 'rendering', renderError: null } });
  // detached で独立したプロセスグループにし、停止のときにまとめて止める（記録するのはグループの先頭 = npx の pid）
  const child = spawn('npx', ['tsx', 'agent/render-runner.ts', projectId], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  child.unref();
  if (child.pid) await prisma.shortClip.update({ where: { id: clip.id }, data: { renderPid: child.pid } });
  return null;
}

export async function stopRender(projectId: string): Promise<boolean> {
  const clip = await clipOf(projectId);
  if (clip.renderStatus !== 'rendering') return false;
  if (clip.renderPid) {
    try {
      process.kill(-clip.renderPid, 'SIGTERM');
    } catch {
      // すでに終わっている
    }
  }
  await prisma.shortClip.update({ where: { id: clip.id }, data: { renderStatus: 'failed', renderPid: null, renderError: '作り直しを止めました（動画は前のままです）' } });
  return true;
}

/** 作り直しの進み具合（produce が出す進み具合の行のうち最後のもの。例: 「🎙️ 3/10 …」「🎬 レンダリング中...」）。Remotion の警告などの行は出さない */
export function renderProgress(projectId: string): string | null {
  try {
    const lines = fs.readFileSync(produceLogPath(projectId), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => /^(🎬|🎙️|✅)/u.test(l));
    return lines[lines.length - 1] ?? null;
  } catch {
    return null;
  }
}

// ---------- AI に台本を直してもらう ----------

export async function postEditChat(projectId: string, text: string): Promise<string | null> {
  const blocked = await editBlockedReason(projectId);
  if (blocked) return blocked;
  if (await prisma.projectEditMessage.count({ where: { projectId, status: 'pending' } })) return 'AI が答えている途中です';
  if ((await clipOf(projectId)).renderStatus === 'rendering') return '動画を作り直している途中です。終わってから頼んでください';
  await prisma.projectEditMessage.create({ data: { projectId, role: 'user', content: text } });
  const reply = await prisma.projectEditMessage.create({ data: { projectId, role: 'assistant', status: 'pending' } });
  const child = spawn('npx', ['tsx', 'agent/edit-runner.ts', reply.id], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  child.unref();
  if (child.pid) await prisma.projectEditMessage.update({ where: { id: reply.id }, data: { pid: child.pid } });
  return null;
}

export async function stopEditChat(projectId: string): Promise<number> {
  const pending = await prisma.projectEditMessage.findMany({ where: { projectId, status: 'pending' } });
  for (const m of pending) {
    if (m.pid) {
      try {
        process.kill(-m.pid, 'SIGTERM');
      } catch {
        // すでに終わっている
      }
    }
    await prisma.projectEditMessage.update({ where: { id: m.id }, data: { status: 'canceled', content: '止めました', pid: null } });
  }
  return pending.length;
}

const EDIT_SYSTEM_PROMPT = [
  'あなたは YouTube ショート動画の台本を、運用担当者の指示どおりに直す編集担当です。日本語で、短く具体的に答えます。',
  '返事は画面にそのまま表示されるため、マークダウンの強調（** や #）は使いません。箇条書きは「- 」だけを使います。',
  '動画は縦型（9:16）で、1行 = 読み上げ1回 = 字幕1枚。字幕は \\n 区切りの1行が全角13字程度までです。',
  '事実は、渡されたリサーチの要約と出典に書いてあることだけを使います。推測で数字や日付を作りません。',
  '絵文字は使いません。特定の企業・人物を応援・批判する言い回しはしません。',
].join('\n');


export async function runEditMessage(messageId: string): Promise<void> {
  const message = await prisma.projectEditMessage.findUnique({
    where: { id: messageId },
    include: {
      project: {
        include: {
          account: true,
          template: true,
          trendResearch: true,
          shortClips: true,
          editMessages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });
  if (!message || message.status !== 'pending') return;
  const { project } = message;
  const clip = project.shortClips[0];
  const stillPending = async () => (await prisma.projectEditMessage.findUnique({ where: { id: message.id } }))?.status === 'pending';

  try {
    const lines = safeJson<ScriptLine[]>(clip?.scriptJson, []);
    // 今回の指示（いちばん新しい担当者の発言）と、それより前のやりとり（直近20件。作業中・停止・失敗は除く）
    const request = project.editMessages.filter((m) => m.role === 'user').at(-1);
    const history = project.editMessages
      .filter((m) => m.status === 'done' && m.id !== request?.id)
      .slice(-20)
      .map((m) => `${m.role === 'user' ? '担当者' : 'あなた'}: ${m.content}`);
    const sources = safeJson<{ title: string; url: string }[]>(project.trendResearch?.sourcesJson, []);
    const prompt = [
      `## チャンネル「${project.account.name}」\n- コンセプト: ${project.account.concept}\n- 視聴者: ${project.account.targetAudience}`,
      project.template ? `## 構成案「${project.template.name}」（台本はこの型に沿っている）\n${project.template.body}` : '## 構成案\n（記録なし）',
      project.trendResearch
        ? `## リサーチ（事実はこの範囲だけ）\n- 話題: ${project.trendResearch.topic}\n- 要約: ${project.trendResearch.summary ?? '（なし）'}\n- 出典: ${sources.map((s) => `${s.title} ${s.url}`).join(' / ') || '（なし）'}`
        : '## リサーチ\n（記録なし。事実は今の台本に書いてある範囲だけを使う）',
      `## 今の台本（タイトル: ${project.title}）\n\`\`\`json\n${JSON.stringify(lines, null, 2)}\n\`\`\``,
      '## 場面の型定義（scene の各項目はこの型に合わせる）\n```ts\n' + fs.readFileSync(path.resolve(process.cwd(), 'remotion/types.ts'), 'utf-8') + '\n```',
      `## これまでのやりとり\n${history.join('\n\n') || '（まだありません）'}`,
      `## 担当者の今回の指示\n${request?.content ?? ''}`,
      '## 答え方',
      '- reply: 何をどう直したか（または直さない理由）を短く。',
      '- lines: 台本を直すときは、直した後の全行（直していない行もそのまま含める）。直さないときは null。',
      '- title: タイトルを直すときは新しいタイトル（30字程度まで）。直さないときは null。',
    ].join('\n\n');
    const out = await runAiJson<{ reply: string; title: string | null; lines: ScriptLine[] | null }>('edit', EDIT_SYSTEM_PROMPT, prompt, EDIT_SCHEMA);
    if (!(await stillPending())) return;
    if (out.lines) {
      const error = validateScriptLines(out.lines);
      if (error) throw new Error(`台本の形が正しくありませんでした（${error}）。もう一度頼んでください`);
    }
    const title = out.title?.trim() ? out.title.trim().slice(0, TITLE_MAX) : null;
    await prisma.$transaction([
      prisma.projectEditMessage.update({
        where: { id: message.id },
        data: { status: 'done', content: out.reply, linesJson: out.lines ? JSON.stringify(out.lines) : null, pid: null },
      }),
      ...(title ? [prisma.project.update({ where: { id: project.id }, data: { title } })] : []),
      ...(clip && (out.lines || title)
        ? [
            prisma.shortClip.update({
              where: { id: clip.id },
              data: {
                ...(title ? { title } : {}),
                ...(out.lines ? { scriptJson: JSON.stringify(out.lines), hookSentence: out.lines[0].caption ?? out.lines[0].text } : {}),
              },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    if (!(await stillPending())) return;
    await prisma.projectEditMessage.update({
      where: { id: message.id },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error), pid: null },
    });
  }
}
