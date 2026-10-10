import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { jobDir } from '@/lib/storage';
import { JOB_PURPOSES, PROVIDER_LABEL as AI_LABEL, type AiProvider, type JobPurpose } from '@/lib/ai/providers';

// 依頼の provider。"steps" は工程ごとに AI を使う依頼（2026-10-11 から）。ほかは以前の依頼
export const PROVIDER_LABEL: Record<string, string> = {
  steps: '工程ごとの AI',
  'claude-code': 'Claude Code',
  antigravity: 'Antigravity（Gemini）',
};

// 依頼した時点の、工程ごとの AI とモデル
export type AiSteps = Record<JobPurpose, { provider: AiProvider; model: string }>;

export function parseAiSteps(json: string | null): AiSteps | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as AiSteps;
    return JOB_PURPOSES.every((p) => v[p]?.provider && v[p]?.model) ? v : null;
  } catch {
    return null;
  }
}

/** 一覧に出す、依頼に使った AI（工程ごとの依頼は使った AI の名前を重ねずに並べる） */
export function jobAiLabel(job: { provider: string; aiStepsJson: string | null }): string {
  const steps = parseAiSteps(job.aiStepsJson);
  if (!steps) return PROVIDER_LABEL[job.provider] ?? job.provider;
  return [...new Set(JOB_PURPOSES.map((p) => AI_LABEL[steps[p].provider]))].join('・');
}

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

/** 依頼の一覧（全アカウント。新しい順） */
export async function loadJobs(take = 20) {
  return syncAntigravity(await prisma.agentJob.findMany({ include, orderBy: { createdAt: 'desc' }, take }));
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
  const file = path.join(jobDir(jobId), 'log.jsonl');
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
    // agent/job-runner.ts が書く行（Claude Code 以外の工程の記録）
    if (msg.type === 'step') {
      const step = msg as { kind?: string; text?: string; name?: string; detail?: string };
      if (step.kind === 'text' && step.text) entries.push({ kind: 'text', text: step.text });
      if (step.kind === 'tool') entries.push({ kind: 'tool', name: step.name ?? '', detail: step.detail ?? '' });
    }
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

// 依頼の工程（agent/job-runner.ts が AgentJob.phase に記録する）
export const JOB_PHASES = ['research', 'script', 'produce', 'check'] as const;
export type JobPhase = (typeof JOB_PHASES)[number];
export const JOB_STEPS = ['リサーチ', '台本', '制作', '点検'] as const;

/** 今どの工程か（-1: まだ始まっていない / 記録のない以前の依頼） */
export function jobProgress(phase: string | null): number {
  return JOB_PHASES.indexOf(phase as JobPhase);
}

export function elapsed(from: Date, to: Date = new Date()): string {
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
}
