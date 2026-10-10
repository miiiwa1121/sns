import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { DATA_DIR, jobDir, projectDir, projectWorkDir } from '@/lib/storage';

/**
 * data/ に溜まる生成物の整理。管理画面の「設定」から設定・実行し、自動整理が有効なら依頼の終了時にも動く。
 * DB の行は消さない（動画を消した企画は、画面に「削除済み」と出る）。
 */

const SETTING_ID = 'app';

export async function loadSettings() {
  return (
    (await prisma.appSetting.findUnique({ where: { id: SETTING_ID } })) ??
    (await prisma.appSetting.create({ data: { id: SETTING_ID } }))
  );
}

export async function saveCleanupSettings(input: { auto: boolean; days: number; includeVideo: boolean }) {
  await loadSettings();
  await prisma.appSetting.update({
    where: { id: SETTING_ID },
    data: { cleanupAuto: input.auto, cleanupDays: input.days, cleanupIncludeVideo: input.includeVideo },
  });
}

function sizeOf(target: string): number {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.size;
  return fs.readdirSync(target).reduce((sum, name) => sum + sizeOf(path.join(target, name)), 0);
}

export interface StorageUsage {
  projects: number; // 企画（動画・作業ファイル）
  jobs: number; // 依頼の作業フォルダ
  other: number; // scratch など
}

export function storageUsage(): StorageUsage {
  const projects = sizeOf(path.join(DATA_DIR, 'projects'));
  const jobs = sizeOf(path.join(DATA_DIR, 'jobs'));
  return { projects, jobs, other: sizeOf(DATA_DIR) - projects - jobs };
}

export interface CleanupItem {
  kind: 'work' | 'video' | 'job';
  label: string; // 企画名・依頼のお題
  targets: string[]; // 消すファイル・フォルダ（絶対パス）
  bytes: number;
}

/** 今の設定で整理したら消えるもの（実際には消さない） */
export async function planCleanup(settings: { cleanupDays: number; cleanupIncludeVideo: boolean }): Promise<CleanupItem[]> {
  const cutoff = new Date(Date.now() - settings.cleanupDays * 24 * 60 * 60 * 1000);
  const items: CleanupItem[] = [];
  const add = (kind: CleanupItem['kind'], label: string, ...targets: string[]) => {
    const bytes = targets.reduce((sum, t) => sum + sizeOf(t), 0);
    if (bytes > 0) items.push({ kind, label, targets, bytes });
  };

  const projects = await prisma.project.findMany({
    where: { publishLogs: { some: { platform: 'youtube', status: 'published', publishedAt: { lt: cutoff } } } },
    orderBy: { createdAt: 'asc' },
  });
  for (const p of projects) {
    add('work', p.title, projectWorkDir(p.id));
    if (settings.cleanupIncludeVideo) {
      add('video', p.title, path.join(projectDir(p.id), 'video.mp4'), path.join(projectDir(p.id), 'thumb.jpg'));
    }
  }

  const jobs = await prisma.agentJob.findMany({
    where: { status: { not: 'running' }, finishedAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
  });
  for (const j of jobs) add('job', j.theme || 'おまかせ', jobDir(j.id));
  return items;
}

/** 今の設定で整理する。消した量（バイト）を返す */
export async function runCleanup(): Promise<{ removed: number; bytes: number }> {
  const settings = await loadSettings();
  const items = await planCleanup(settings);
  for (const target of items.flatMap((i) => i.targets)) fs.rmSync(target, { recursive: true, force: true });
  const bytes = items.reduce((sum, i) => sum + i.bytes, 0);
  await prisma.appSetting.update({ where: { id: SETTING_ID }, data: { lastCleanupAt: new Date(), lastCleanupBytes: bytes } });
  return { removed: items.length, bytes };
}

/** 自動整理が有効なときだけ整理する（依頼の終了時に呼ぶ） */
export async function runAutoCleanup(): Promise<void> {
  const settings = await loadSettings();
  if (settings.cleanupAuto) await runCleanup();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}
