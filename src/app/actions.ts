'use server';

// 管理画面からの操作。Server Actions は Next.js が Origin と Host を照合するため、別サイトからは呼べない。
// 開発サーバーは 127.0.0.1 にのみバインドしている（ログイン機能は持たない）。

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import { spawn } from 'child_process';
import { projectDir } from '@/lib/storage';
import { CHANNEL_COOKIE, getCurrentChannel } from '@/lib/channel';
import { PLATFORM_LABEL, PlatformType } from '@/lib/types';
import { publishProject, recordManualPublish, extractYouTubeVideoId, PLATFORMS } from '@/lib/services/publishService';
import { analyzeProject, recordMetrics } from '@/lib/services/analyticsService';
import { fetchYouTubeMetrics } from '@/lib/analytics/youtubeMetrics';
import { formatBytes, runCleanup, saveCleanupSettings } from '@/lib/services/cleanupService';
import { saveEnvValues } from '@/lib/envFile';
import { listTemplates, validateTemplate } from '@/lib/services/templateService';
import { postChat, postSample, renameWorkshopTemplate, startWorkshop, stopWorkshop, workshopBusy } from '@/lib/services/workshopService';
import { postEditChat, saveScript, startRender, stopEditChat, stopRender } from '@/lib/services/editService';
import type { ScriptLine } from '@/lib/script';

export type ActionState = { ok: boolean; message: string } | null;

const done = (message: string): ActionState => {
  revalidatePath('/', 'layout');
  return { ok: true, message };
};
const fail = (message: string): ActionState => ({ ok: false, message });

// 絵コンテ（docs/videos/）に投稿 URL を反映する。CLI の storyboard を別プロセスで動かす（画面の応答は待たせない）
function refreshStoryboard(projectId: string) {
  spawn('npx', ['tsx', 'agent/cli.ts', 'storyboard', projectId], { cwd: process.cwd(), detached: true, stdio: 'ignore' }).unref();
}

function isPlatform(v: unknown): v is PlatformType {
  return typeof v === 'string' && (PLATFORMS as string[]).includes(v);
}

export async function selectChannel(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const exists = await prisma.account.findUnique({ where: { slug } });
  if (!exists) return;
  (await cookies()).set(CHANNEL_COOKIE, slug, { sameSite: 'lax', httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}

export async function approveProject(projectId: string): Promise<ActionState> {
  const clip = await prisma.shortClip.findFirst({ where: { projectId } });
  if (!clip?.renderedFilePath) return fail('動画がまだできていません');
  // 台本を直した後に作り直していない動画は承認しない（古い動画を承認してしまうため）
  if (clip.renderStatus === 'rendering') return fail('動画を作り直している途中です。終わってから承認してください');
  if (clip.renderedScriptJson && clip.renderedScriptJson !== clip.scriptJson) return fail('台本を直した後、動画をまだ作り直していません。動画編集で作り直してから承認してください');
  await prisma.shortClip.update({ where: { id: clip.id }, data: { readyToPublish: true } });
  return done('承認しました');
}

export async function publishToYouTube(projectId: string): Promise<ActionState> {
  const outcome = await publishProject(projectId, { platforms: ['youtube'], youtubePrivacy: 'private' });
  if (!outcome.ok) return fail(outcome.error);
  if (outcome.failed.length > 0) {
    revalidatePath('/', 'layout');
    return fail(outcome.failed.map((f) => f.message).join(' / '));
  }
  refreshStoryboard(projectId);
  return done('YouTube に投稿しました（非公開）。YouTube Studio で「公開」に切り替えてください');
}

export async function recordPostUrl(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const platform = formData.get('platform');
  const url = String(formData.get('url') ?? '').trim();
  if (!isPlatform(platform)) return fail('媒体が不正です');
  if (!/^https?:\/\//.test(url)) return fail('URL は https:// から始まる形で入力してください');
  if (platform === 'youtube' && !extractYouTubeVideoId(url)) return fail('YouTube の動画 URL を入力してください');
  await recordManualPublish(projectId, platform, url);
  refreshStoryboard(projectId);
  return done(`${PLATFORM_LABEL[platform]} の投稿を記録しました`);
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').replace(/,/g, '').trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function saveMetrics(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const platform = formData.get('platform');
  if (!isPlatform(platform)) return fail('媒体が不正です');
  const views = num(formData, 'views');
  const likes = num(formData, 'likes') ?? 0;
  const comments = num(formData, 'comments') ?? 0;
  const shares = num(formData, 'shares') ?? 0;
  const retention = num(formData, 'retention');
  if (views === null || [views, likes, comments, shares].some(Number.isNaN)) return fail('数字は0以上で入力してください（再生数は必須）');
  if (retention !== null && (Number.isNaN(retention) || retention > 100)) return fail('視聴維持率は0〜100で入力してください（分からなければ空欄）');

  const error = await recordMetrics(projectId, [{
    platform,
    views,
    likes,
    comments,
    shares,
    engagementRate: views > 0 ? Math.round(((likes + comments + shares) / views) * 1000) / 10 : 0,
    retentionRate: retention,
  }]);
  if (error) return fail(error);
  await analyzeProject(projectId, true);
  return done(`${PLATFORM_LABEL[platform]} の数字を保存して分析しました`);
}

export async function collectYouTubeMetrics(projectId: string): Promise<ActionState> {
  const log = await prisma.publishLog.findFirst({ where: { projectId, platform: 'youtube', status: 'published' }, include: { project: { include: { account: true } } } });
  if (!log?.externalId || !log.publishedAt) return fail('YouTube の投稿がありません');
  const result = await fetchYouTubeMetrics(log.project.account.slug, log.externalId, log.publishedAt);
  if (!result.ok) return fail(result.error);
  const error = await recordMetrics(projectId, [result.metric]);
  if (error) return fail(error);
  await analyzeProject(projectId, true);
  return done(result.retentionAvailable ? 'YouTube の数字を取得して分析しました' : 'YouTube の数字を取得しました（視聴維持率はまだ反映されていません。1〜2日後にもう一度取得してください）');
}

export async function deleteDraftProject(projectId: string) {
  const published = await prisma.publishLog.count({ where: { projectId, status: 'published' } });
  if (published > 0) throw new Error('配信済みの企画は削除できません');
  await prisma.project.delete({ where: { id: projectId } });
  // 企画のファイル（動画・作業ファイル）もフォルダごと消す。DB に存在した ID のときだけここに来る
  fs.rmSync(projectDir(projectId), { recursive: true, force: true });
  revalidatePath('/', 'layout');
  redirect('/projects');
}

// ---------- 動画づくりの依頼（AgentJob） ----------

const PROVIDERS = ['claude-code', 'antigravity'] as const;

export async function createVideoJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const provider = formData.get('provider');
  const theme = String(formData.get('theme') ?? '').trim().slice(0, 300) || null;
  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) return fail('AI を選んでください');
  const channel = await getCurrentChannel();
  if (!channel) return fail('チャンネルがありません');
  // 同時に動かすのは1件まで（音声合成・レンダリングが重いため）
  const running = await prisma.agentJob.findFirst({ where: { status: 'running' } });
  if (running) return fail('作業中の依頼があります。終わってから依頼してください');
  const template = (await listTemplates()).find((t) => t.id === formData.get('templateId'));
  if (!template) return fail('構成案を選んでください');

  // 構成案は名前と本文の写しも残す（あとで構成案を編集・削除しても、何で作ったか分かるように）
  const job = await prisma.agentJob.create({
    data: { accountId: channel.id, provider: String(provider), theme, templateId: template.id, templateName: template.name, templateBody: template.body },
  });
  // 依頼の実行は別プロセスで行う（画面の応答を待たせない）
  const child = spawn('npx', ['tsx', 'agent/job-runner.ts', job.id], { cwd: process.cwd(), detached: true, stdio: 'ignore' });
  child.unref();
  revalidatePath('/', 'layout');
  redirect(`/jobs/${job.id}`);
}

export async function cancelJob(jobId: string): Promise<ActionState> {
  const job = await prisma.agentJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'running') return fail('作業中の依頼ではありません');
  if (job.pid) {
    try {
      process.kill(job.pid);
    } catch {
      // すでに終了している
    }
  }
  await prisma.agentJob.update({ where: { id: jobId }, data: { status: 'canceled', finishedAt: new Date(), pid: null } });
  return done('依頼を中止しました');
}

// ---------- アカウント（チャンネル） ----------

const SLUG = /^[a-z0-9][a-z0-9_-]{2,39}$/;

function accountFields(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? '').trim();
  return {
    name: get('name'),
    category: get('category') || 'AI・IT',
    concept: get('concept'),
    targetAudience: get('targetAudience'),
    defaultTemplateId: get('defaultTemplateId') || null,
  };
}

// SNS ごとのハンドル（入力欄 handle_<platform>）
function handleFields(formData: FormData): Record<PlatformType, string> {
  return Object.fromEntries(PLATFORMS.map((p) => [p, String(formData.get(`handle_${p}`) ?? '').trim().slice(0, 100)])) as Record<PlatformType, string>;
}

async function validateTemplateRef(templateId: string | null): Promise<string | null> {
  if (!templateId) return null;
  return (await prisma.structureTemplate.findUnique({ where: { id: templateId } })) ? null : '構成案が見つかりません';
}

function validateAccount(f: ReturnType<typeof accountFields>): string | null {
  if (!f.name || f.name.length > 50) return 'アカウント名は1〜50文字で入力してください';
  if (!f.concept) return 'コンセプトを入力してください（台本づくりに使います）';
  if (!f.targetAudience) return '想定する視聴者を入力してください';
  return null;
}

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = accountFields(formData);
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  if (!SLUG.test(slug)) return fail('ID は半角英小文字・数字・-・_ の3〜40文字で入力してください');
  const error = validateAccount(f) ?? (await validateTemplateRef(f.defaultTemplateId));
  if (error) return fail(error);
  if (await prisma.account.findUnique({ where: { slug } })) return fail('この ID は使われています');

  const handles = handleFields(formData);
  await prisma.account.create({
    data: {
      ...f,
      slug,
      platformConnections: {
        create: PLATFORMS.map((platform) => ({ platform, handle: handles[platform], isConnected: false })),
      },
    },
  });
  // 作ったアカウントに切り替える
  (await cookies()).set(CHANNEL_COOKIE, slug, { sameSite: 'lax', httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
  redirect(`/accounts/${slug}`);
}

export async function updateAccount(accountId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = accountFields(formData);
  const error = validateAccount(f) ?? (await validateTemplateRef(f.defaultTemplateId));
  if (error) return fail(error);
  await prisma.account.update({ where: { id: accountId }, data: f });
  const handles = handleFields(formData);
  const conns = await prisma.platformConnection.findMany({ where: { accountId } });
  for (const platform of PLATFORMS) {
    const conn = conns.find((c) => c.platform === platform);
    if (conn) await prisma.platformConnection.update({ where: { id: conn.id }, data: { handle: handles[platform] } });
    else await prisma.platformConnection.create({ data: { accountId, platform, handle: handles[platform], isConnected: false } });
  }
  return done('保存しました');
}

// ---------- 設定（生成物の整理） ----------

export async function saveCleanup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const days = Number(formData.get('days'));
  if (!Number.isInteger(days) || days < 1 || days > 3650) return fail('日数は 1〜3650 の整数で入力してください');
  await saveCleanupSettings({
    auto: formData.get('auto') === 'on',
    days,
    includeVideo: formData.get('includeVideo') === 'on',
  });
  return done('保存しました');
}

export async function cleanupNow(): Promise<ActionState> {
  const { removed, bytes } = await runCleanup();
  return done(removed === 0 ? '整理する対象はありませんでした' : `${removed} 件・${formatBytes(bytes)} を削除しました`);
}

// ---------- 設定（YouTube API のクライアント） ----------

export async function saveYouTubeClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const clientId = String(formData.get('clientId') ?? '').trim();
  const clientSecret = String(formData.get('clientSecret') ?? '').trim();
  if (!clientId && !clientSecret) return fail('クライアント ID かシークレットを入力してください');
  if (clientId && !clientId.endsWith('.apps.googleusercontent.com')) return fail('クライアント ID は「….apps.googleusercontent.com」の形です');
  // 空欄の項目は今の値のまま（シークレットは画面に表示しないため、変えるときだけ入力する）
  saveEnvValues({
    ...(clientId ? { YOUTUBE_CLIENT_ID: clientId } : {}),
    ...(clientSecret ? { YOUTUBE_CLIENT_SECRET: clientSecret } : {}),
  });
  return done('保存しました');
}

// ---------- 構成案 ----------

function templateFields(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? '').trim();
  return { name: get('name'), description: get('description'), body: get('body') };
}

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = templateFields(formData);
  const error = validateTemplate(f);
  if (error) return fail(error);
  const created = await prisma.structureTemplate.create({ data: { ...f, description: f.description || null } });
  revalidatePath('/', 'layout');
  redirect(`/templates/${created.id}`);
}

export async function updateTemplate(templateId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = templateFields(formData);
  const error = validateTemplate(f);
  if (error) return fail(error);
  await prisma.structureTemplate.update({ where: { id: templateId }, data: { ...f, description: f.description || null } });
  return done('保存しました（これからの依頼に使われます。作成済みの企画は変わりません）');
}

export async function deleteTemplate(templateId: string): Promise<ActionState> {
  const templates = await listTemplates();
  if (templates.length <= 1) return fail('構成案が1件だけのときは削除できません');
  const inUse = await prisma.account.count({ where: { defaultTemplateId: templateId } });
  if (inUse > 0) return fail(`${inUse} 件のアカウントの既定になっています。先にアカウントの既定を変えてください`);
  // 依頼・企画からの参照は外れる（依頼には名前と本文の写しが残る）。この構成案を直していた相談も一緒に消える
  await prisma.structureTemplate.delete({ where: { id: templateId } });
  revalidatePath('/', 'layout');
  redirect('/templates');
}

// ---------- 構成案を AI と相談して作る ----------

export async function startTemplateWorkshop(baseTemplateId: string | null) {
  const channel = await getCurrentChannel();
  if (!channel) throw new Error('アカウントがありません');
  const workshop = await startWorkshop(channel.id, baseTemplateId);
  redirect(`/templates/workshop/${workshop.id}`);
}

export async function sendWorkshopChat(workshopId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get('text') ?? '').trim().slice(0, 2000);
  if (!text) return fail('相談したいことを入力してください');
  if (await workshopBusy(workshopId)) return fail('AI が答えている途中です。少し待ってください');
  await postChat(workshopId, text);
  return done('送りました');
}

export async function requestWorkshopSample(workshopId: string): Promise<ActionState> {
  if (await workshopBusy(workshopId)) return fail('AI が作業している途中です。止めるか、終わるまで待ってください');
  await postSample(workshopId);
  return done('試作を頼みました（30秒ほどかかります）');
}

export async function stopWorkshopAction(workshopId: string): Promise<ActionState> {
  const stopped = await stopWorkshop(workshopId);
  return done(stopped === 0 ? '止める作業はありませんでした' : '止めました');
}

export async function renameWorkshop(workshopId: string, name: string): Promise<ActionState> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) return fail('名前は1〜60文字で入力してください');
  await renameWorkshopTemplate(workshopId, trimmed);
  return done('名前を変えました');
}

/** 相談を削除する（= 相談で作った構成案ごと消す。構成案の削除と同じ条件） */
export async function deleteWorkshop(workshopId: string): Promise<ActionState> {
  const w = await prisma.templateWorkshop.findUnique({ where: { id: workshopId } });
  if (!w) return fail('相談が見つかりません');
  return deleteTemplate(w.templateId);
}

// ---------- 動画編集（/projects/[id]/edit） ----------

export async function saveProjectScript(projectId: string, title: string, lines: ScriptLine[]): Promise<ActionState> {
  const error = await saveScript(projectId, title, lines);
  return error ? fail(error) : done('保存しました');
}

export async function renderProject(projectId: string): Promise<ActionState> {
  const error = await startRender(projectId);
  return error ? fail(error) : done('作り直しを始めました（数分かかります）');
}

export async function stopProjectWork(projectId: string): Promise<ActionState> {
  const [render, chat] = await Promise.all([stopRender(projectId), stopEditChat(projectId)]);
  return done(render || chat > 0 ? '止めました' : '止める作業はありませんでした');
}

export async function sendEditChat(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get('text') ?? '').trim().slice(0, 2000);
  if (!text) return fail('直したいことを入力してください');
  const error = await postEditChat(projectId, text);
  return error ? fail(error) : done('送りました');
}
