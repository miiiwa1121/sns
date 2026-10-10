import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export const PROVIDER_LABEL: Record<string, string> = {
  'claude-code': 'Claude Code',
  antigravity: 'Antigravity（Gemini）',
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  running: '作業中',
  succeeded: '完了',
  failed: '失敗',
  canceled: '中止',
};

const include = { account: true, project: { include: { shortClips: true } } } as const;

// Antigravity は IDE 上で動くため、企画の動画ができたら完了とみなす
async function syncAntigravity<T extends { id: string; provider: string; status: string; project: { shortClips: { renderedFilePath: string | null }[] } | null }>(jobs: T[]): Promise<T[]> {
  for (const j of jobs) {
    if (j.provider === 'antigravity' && j.status === 'running' && j.project?.shortClips[0]?.renderedFilePath) {
      await prisma.agentJob.update({ where: { id: j.id }, data: { status: 'succeeded', finishedAt: new Date() } });
      j.status = 'succeeded';
    }
  }
  return jobs;
}

export async function loadJobs(accountId: string, take = 20) {
  return syncAntigravity(await prisma.agentJob.findMany({ where: { accountId }, include, orderBy: { createdAt: 'desc' }, take }));
}

export async function loadRunningJobs() {
  return syncAntigravity(await prisma.agentJob.findMany({ where: { status: 'running' }, include, orderBy: { createdAt: 'desc' } }));
}

export async function loadJob(id: string) {
  const job = await prisma.agentJob.findUnique({ where: { id }, include });
  return job ? (await syncAntigravity([job]))[0] : null;
}

export type LogEntry =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'result'; text: string; error: boolean };

// Claude Code の stream-json 出力（log.jsonl）を、画面に出す行に変換する
export function readJobLog(jobId: string): LogEntry[] {
  const file = path.resolve('out/agent/jobs', jobId, 'log.jsonl');
  if (!fs.existsSync(file)) return [];
  const entries: LogEntry[] = [];
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    let msg: { type?: string; message?: { content?: unknown[] }; result?: string; is_error?: boolean };
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.type === 'assistant') {
      for (const block of (msg.message?.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[]) {
        if (block.type === 'text' && block.text?.trim()) entries.push({ kind: 'text', text: block.text.trim() });
        if (block.type === 'tool_use') entries.push({ kind: 'tool', name: block.name ?? '', detail: describeTool(block.name, block.input) });
      }
    }
    if (msg.type === 'result') entries.push({ kind: 'result', text: msg.result ?? '', error: Boolean(msg.is_error) });
  }
  return entries;
}

function describeTool(name: string | undefined, input: Record<string, unknown> = {}): string {
  const s = (v: unknown) => String(v ?? '');
  switch (name) {
    case 'WebSearch':
      return `検索: ${s(input.query)}`;
    case 'WebFetch':
      return `ページを読む: ${s(input.url)}`;
    case 'Bash':
      return s(input.command).replace(/npm --prefix \S+ run -s agent -- /, 'agent ');
    case 'Read':
    case 'Write':
    case 'Edit':
      return `${{ Read: '読む', Write: '書く', Edit: '直す' }[name]}: ${path.basename(s(input.file_path))}`;
    default:
      return name ?? '';
  }
}

export const JOB_STEPS = ['リサーチ', '登録', '台本', '制作', '点検'] as const;

// 作業の記録から、どの工程まで進んだかを推定する（-1: まだ何もしていない）
export function jobProgress(entries: LogEntry[]): number {
  let step = -1;
  for (const e of entries) {
    if (e.kind !== 'tool') continue;
    if (e.name === 'WebSearch' || e.name === 'WebFetch') step = Math.max(step, 0);
    if (e.detail.includes('trend:add')) step = Math.max(step, 1);
    if (e.detail.includes('project:create') || e.detail.includes('project:update')) step = Math.max(step, 2);
    if (e.detail.includes('produce')) step = Math.max(step, 3);
    if (step >= 3 && e.name === 'Read' && e.detail.includes('preview.png')) step = Math.max(step, 4);
  }
  return step;
}

export function elapsed(from: Date, to: Date = new Date()): string {
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
}
