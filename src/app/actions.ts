'use server';

// 管理画面からの操作。Server Actions は Next.js が Origin と Host を照合するため、別サイトからは呼べない。
// 開発サーバーは 127.0.0.1 にのみバインドしている（ログイン機能は持たない）。

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import { spawn } from 'child_process';
import { projectDir } from '@/lib/storage';
import { firstChannel } from '@/lib/channel';
import { PLATFORM_LABEL, PlatformType } from '@/lib/types';
import { publishProject, recordManualPublish, extractYouTubeVideoId, PLATFORMS } from '@/lib/services/publishService';
import { analyzeProject, recordMetrics } from '@/lib/services/analyticsService';
import { fetchYouTubeMetrics } from '@/lib/analytics/youtubeMetrics';
import { formatBytes, runCleanup, saveCleanupSettings } from '@/lib/services/cleanupService';
import { removeEnvValues, saveEnvValues } from '@/lib/envFile';
import { listTemplates, validateTemplate } from '@/lib/services/templateService';
import { listProhibitions, listResearchMethods, validateProhibition, validateResearchMethod } from '@/lib/services/researchMethodService';
import { postChat, postSample, renameWorkshopTemplate, startWorkshop, stopWorkshop, workshopBusy } from '@/lib/services/workshopService';
import { postEditChat, saveScript, startRender, stopEditChat, stopRender } from '@/lib/services/editService';
import type { ScriptLine } from '@/lib/script';
import { PING_SCHEMA } from '@/lib/ai/schemas';
import type { AiSteps } from '@/lib/jobs';
import { validateProduceRequest } from '@/lib/services/produceSettings';
import {
  DEFAULT_MODEL,
  JOB_PURPOSES,
  PROVIDER_LABEL,
  SETTING_KEY,
  checkAntigravity,
  loadAiSettings,
  providerProblem,
  validateAssignment,
  type ChatPurpose,
  providerForEnv,
  runProviderJson,
  validateApiKeyEntry,
  validateLocalAi,
  type AiProvider,
  type AiPurpose,
} from '@/lib/ai/providers';

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

export async function createVideoJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // 工程ごとの AI は「AI 連携」の割り当てで決める（依頼の画面では選ばない）。依頼した時点の割り当てを写して残す
  const ai = await loadAiSettings();
  const steps = Object.fromEntries(JOB_PURPOSES.map((p) => [p, ai[p]])) as AiSteps;
  // 制作の声・速さ・BGM（"auto" は「おまかせ」= 台本の担当 AI が選ぶ）
  const pick = (k: string) => {
    const v = String(formData.get(k) ?? 'auto');
    return v === 'auto' ? null : v;
  };
  const speed = pick('produceSpeed');
  const produce = { voice: pick('produceVoice'), speed: speed === null ? null : Number(speed), bgm: pick('produceBgm') };
  const produceError = validateProduceRequest(produce);
  if (produceError) return fail(produceError);
  const problem = JOB_PURPOSES.map((p) => providerProblem(steps[p].provider, ai)).find(Boolean);
  if (problem) return fail(problem);
  const theme = String(formData.get('theme') ?? '').trim().slice(0, 300) || null;
  const channel = await prisma.account.findFirst({ where: { id: String(formData.get('accountId') ?? ''), isActive: true } });
  if (!channel) return fail('アカウントを選んでください');
  // 同時に動かすのは1件まで（音声合成・レンダリングが重いため）
  const running = await prisma.agentJob.findFirst({ where: { status: 'running' } });
  if (running) return fail('作業中の依頼があります。終わってから依頼してください');
  const template = (await listTemplates()).find((t) => t.id === formData.get('templateId'));
  if (!template) return fail('構成案を選んでください');
  const researchMethod = (await listResearchMethods()).find((m) => m.id === formData.get('researchMethodId'));
  if (!researchMethod) return fail('リサーチ手法を選んでください');
  const selected = new Set(formData.getAll('prohibitionIds').map(String));
  const prohibitions = (await listProhibitions()).filter((p) => selected.has(p.id)).map((p) => p.text);

  // 構成案・リサーチ手法・禁止事項は本文の写しも残す（あとで編集・削除しても、何で作ったか分かるように）
  const job = await prisma.agentJob.create({
    data: {
      accountId: channel.id,
      provider: 'steps',
      aiStepsJson: JSON.stringify(steps),
      produceJson: JSON.stringify(produce),
      theme,
      templateId: template.id,
      templateName: template.name,
      templateBody: template.body,
      researchMethodId: researchMethod.id,
      researchMethodName: researchMethod.name,
      researchMethodBody: researchMethod.body,
      prohibitionsJson: JSON.stringify(prohibitions),
    },
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
  // 先に中止を記録する（依頼を進めているプロセスは、工程の合間にこれを見て止まる）
  await prisma.agentJob.update({ where: { id: jobId }, data: { status: 'canceled', finishedAt: new Date(), pid: null } });
  if (job.pid) {
    // 工程の作業（Claude Code・CLI）はプロセスグループごと止める。以前の依頼はグループでないので、本体だけ止める
    try {
      process.kill(-job.pid);
    } catch {
      try {
        process.kill(job.pid);
      } catch {
        // すでに終了している
      }
    }
  }
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
    defaultResearchMethodId: get('defaultResearchMethodId') || null,
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

async function validateResearchMethodRef(researchMethodId: string | null): Promise<string | null> {
  if (!researchMethodId) return null;
  return (await prisma.researchMethod.findUnique({ where: { id: researchMethodId } })) ? null : 'リサーチ手法が見つかりません';
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
  const error = validateAccount(f) ?? (await validateTemplateRef(f.defaultTemplateId)) ?? (await validateResearchMethodRef(f.defaultResearchMethodId));
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
  revalidatePath('/', 'layout');
  redirect(`/accounts/${slug}`);
}

export async function updateAccount(accountId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = accountFields(formData);
  const error = validateAccount(f) ?? (await validateTemplateRef(f.defaultTemplateId)) ?? (await validateResearchMethodRef(f.defaultResearchMethodId));
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

// ---------- リサーチ手法 ----------

function researchMethodFields(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? '').trim();
  return { name: get('name'), description: get('description'), body: get('body') };
}

export async function createResearchMethod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = researchMethodFields(formData);
  const error = validateResearchMethod(f);
  if (error) return fail(error);
  const created = await prisma.researchMethod.create({ data: { ...f, description: f.description || null } });
  revalidatePath('/', 'layout');
  redirect(`/research-methods/${created.id}`);
}

export async function updateResearchMethod(researchMethodId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const f = researchMethodFields(formData);
  const error = validateResearchMethod(f);
  if (error) return fail(error);
  await prisma.researchMethod.update({ where: { id: researchMethodId }, data: { ...f, description: f.description || null } });
  return done('保存しました（これからの依頼に使われます。作業中・作成済みの依頼は変わりません）');
}

export async function deleteResearchMethod(researchMethodId: string): Promise<ActionState> {
  const methods = await listResearchMethods();
  if (methods.length <= 1) return fail('リサーチ手法が1件だけのときは削除できません');
  const inUse = await prisma.account.count({ where: { defaultResearchMethodId: researchMethodId } });
  if (inUse > 0) return fail(`${inUse} 件のアカウントの既定になっています。先にアカウントの既定を変えてください`);
  // 依頼からの参照は外れる（依頼には名前と本文の写しが残る）
  await prisma.researchMethod.delete({ where: { id: researchMethodId } });
  revalidatePath('/', 'layout');
  redirect('/research-methods');
}

// ---------- 禁止事項 ----------

export async function createProhibition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get('text') ?? '').trim();
  const error = validateProhibition(text);
  if (error) return fail(error);
  await prisma.prohibition.create({ data: { text, isDefault: formData.get('isDefault') === 'on' } });
  return done('追加しました');
}

export async function updateProhibition(prohibitionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get('text') ?? '').trim();
  const error = validateProhibition(text);
  if (error) return fail(error);
  await prisma.prohibition.update({ where: { id: prohibitionId }, data: { text, isDefault: formData.get('isDefault') === 'on' } });
  return done('保存しました');
}

export async function deleteProhibition(prohibitionId: string): Promise<ActionState> {
  // 依頼には選んだ禁止事項の本文の写しが残るので、消しても記録は変わらない
  await prisma.prohibition.deleteMany({ where: { id: prohibitionId } });
  return done('削除しました');
}

// ---------- 構成案を AI と相談して作る ----------

export async function startTemplateWorkshop(baseTemplateId: string | null) {
  // 相談の前提にするアカウント（コンセプト・視聴者）は一覧の先頭
  const channel = await firstChannel();
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

// ---------- AI 連携 ----------

/** AI 連携の「動画づくりの依頼」（工程ごとの AI とモデル。モデルは必須） */
export async function saveAiAssignments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data: Record<string, string> = {};
  const ai = await loadAiSettings();
  for (const purpose of JOB_PURPOSES) {
    const provider = String(formData.get(`${purpose}Provider`) ?? '');
    const model = String(formData.get(`${purpose}Model`) ?? '').trim();
    const error = await validateAssignment(purpose, provider, model, ai);
    if (error) return fail(error);
    data[`${SETTING_KEY[purpose]}Provider`] = provider;
    data[`${SETTING_KEY[purpose]}Model`] = model;
  }
  await prisma.appSetting.upsert({ where: { id: 'app' }, create: { id: 'app', ...data }, update: data });
  return done('保存しました');
}

/** 制作の声の選択肢に、VOICEVOX の声の一覧を読み込む（エンジンを起動していなければ一時的に起動する。1分ほどかかる） */
export async function loadVoicevoxVoices(): Promise<ActionState> {
  // 一時的に起動したエンジンは読み込み後に止める。制作の途中だと、その制作がこのエンジンにつないで途中で切れることがあるため、制作中は断る
  const busy = (await prisma.agentJob.count({ where: { status: 'running' } })) + (await prisma.shortClip.count({ where: { renderStatus: 'rendering' } }));
  if (busy > 0) return fail('動画を作っている途中（依頼の作業中・動画の作り直し中）は読み込めません。終わってから読み込んでください');
  try {
    const { listVoicevoxSpeakers } = await import('../../agent/tts');
    const count = await listVoicevoxSpeakers();
    return done(`VOICEVOX の声を ${count} 種類読み込みました`);
  } catch (error) {
    return fail(`VOICEVOX の声の一覧を読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** 構成案の相談・動画編集のチャット欄で選ぶ AI とモデル（選んだらすぐ保存する。両方の画面で共通の設定） */
export async function saveChatAi(purpose: ChatPurpose, provider: string, model: string): Promise<ActionState> {
  if (purpose !== 'workshop' && purpose !== 'edit') return fail('用途が正しくありません');
  const trimmed = model.trim();
  const error = await validateAssignment(purpose, provider, trimmed, await loadAiSettings());
  if (error) return fail(error);
  const data = { [`${SETTING_KEY[purpose]}Provider`]: provider, [`${SETTING_KEY[purpose]}Model`]: trimmed };
  await prisma.appSetting.upsert({ where: { id: 'app' }, create: { id: 'app', ...data }, update: data });
  return { ok: true, message: '保存しました' };
}

export async function addApiKey(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const label = String(formData.get('label') ?? '').trim();
  const envName = String(formData.get('envName') ?? '').trim().toUpperCase();
  const value = String(formData.get('value') ?? '').trim();
  const error = validateApiKeyEntry(label, envName, value);
  if (error) return fail(error);
  saveEnvValues({ [envName]: value });
  await prisma.apiKeyEntry.upsert({ where: { envName }, create: { label, envName }, update: { label } });
  return done(`${label}（${envName}）を保存しました`);
}

export async function deleteApiKey(envName: string): Promise<ActionState> {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(envName)) return fail('環境変数名が正しくありません');
  removeEnvValues([envName]);
  await prisma.apiKeyEntry.deleteMany({ where: { envName } });
  return done(`${envName} を消しました`);
}

export async function addLocalAi(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = String(formData.get('kind') ?? '');
  const label = String(formData.get('label') ?? '').trim();
  const binPath = String(formData.get('binPath') ?? '').trim();
  const error = validateLocalAi(kind, label, binPath);
  if (error) return fail(error);
  await prisma.localAiEntry.upsert({ where: { kind }, create: { kind, label, binPath }, update: { label, binPath } });
  return done(`${label} を追加しました`);
}

export async function deleteLocalAi(kind: string): Promise<ActionState> {
  await prisma.localAiEntry.deleteMany({ where: { kind } });
  return done('消しました');
}

/** 接続テストに使うモデル（その AI を割り当てている用途のモデル。なければ既定） */
async function testModelFor(provider: AiProvider): Promise<string> {
  const s = await loadAiSettings();
  return (['workshop', 'edit', ...JOB_PURPOSES] as AiPurpose[]).map((u) => s[u]).find((a) => a.provider === provider && a.model)?.model ?? DEFAULT_MODEL[provider];
}

/** API キーの行の接続テスト */
export async function testApiKey(envName: string): Promise<ActionState> {
  const provider = providerForEnv(envName);
  if (!provider) return fail(`${envName} はこのサービスでは使っていないキーのため、試せません（Claude API は ANTHROPIC_API_KEY、Gemini API は GEMINI_API_KEY）`);
  return testAiProvider(provider);
}

/** API 以外の AI の行の接続テスト */
export async function testLocalAi(kind: string): Promise<ActionState> {
  if (kind !== 'claude-code' && kind !== 'antigravity') return fail('種類が正しくありません');
  return testAiProvider(kind);
}

export async function testAiProvider(provider: AiProvider): Promise<ActionState> {
  const started = Date.now();
  const sec = () => ((Date.now() - started) / 1000).toFixed(1);
  if (provider === 'antigravity') {
    try {
      const version = await checkAntigravity(await loadAiSettings());
      return { ok: true, message: `Antigravity: 起動できました（${version}、${sec()}秒）。依頼は IDE のチャットで動くため、AI の応答までは確かめられません` };
    } catch (error) {
      return fail(`Antigravity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const model = await testModelFor(provider);
  try {
    const out = await runProviderJson<{ reply: string }>(provider, model, 'あなたは接続テストに答えます。日本語で短く答えます。', '「接続できました」とだけ返してください。', PING_SCHEMA);
    return { ok: true, message: `${PROVIDER_LABEL[provider]}${model ? `（${model}）` : ''}: 「${out.reply.slice(0, 40)}」と返りました（${sec()}秒）` };
  } catch (error) {
    return fail(`${PROVIDER_LABEL[provider]} に接続できませんでした: ${error instanceof Error ? error.message : String(error)}`);
  }
}
