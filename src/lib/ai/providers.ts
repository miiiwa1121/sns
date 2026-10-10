import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { toGeminiSchema } from '@/lib/ai/schemas';

/**
 * 連携している AI（管理画面の「AI 連携」）。
 *   claude-code   : Claude Code（CLI。claude.ai へのログインで動く）。すべての用途に使える
 *   antigravity   : Antigravity IDE（IDE のチャットに依頼を送る）。工程の終わりを受け取れないため、今はどの用途にも使わない（2026-10-11 から）
 *   anthropic-api : Claude API（API キー・従量課金）。台本・相談・編集に使える
 *   gemini-api    : Gemini API（API キー・従量課金）。台本・相談・編集に使える
 * 動画づくりの依頼は工程ごとに AI を選ぶ。リサーチ（Web 検索）と点検（画像を見て直す）は、道具を使って作業を進められる Claude Code だけ。
 */

export type AiProvider = 'claude-code' | 'antigravity' | 'anthropic-api' | 'gemini-api';
export type AiPurpose = 'research' | 'script' | 'check' | 'workshop' | 'edit';
// 動画づくりの依頼の工程（AI 連携で選ぶ）。制作（音声とレンダリング）はシステムが行うので AI は使わない
export const JOB_PURPOSES = ['research', 'script', 'check'] as const;
export type JobPurpose = (typeof JOB_PURPOSES)[number];
// 構成案の相談・動画編集（それぞれの画面のチャット欄で選ぶ）
export type ChatPurpose = 'workshop' | 'edit';

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  'claude-code': 'Claude Code',
  antigravity: 'Antigravity（Gemini）',
  'anthropic-api': 'Claude API',
  'gemini-api': 'Gemini API',
};

export const PURPOSE_LABEL: Record<AiPurpose, string> = {
  research: 'リサーチ',
  script: '台本',
  check: '点検',
  workshop: '構成案の相談・試作',
  edit: '動画編集の手直し',
};

// 用途ごとに選べる AI
export const PURPOSE_PROVIDERS: Record<AiPurpose, AiProvider[]> = {
  research: ['claude-code'],
  script: ['claude-code', 'anthropic-api', 'gemini-api'],
  check: ['claude-code'],
  workshop: ['claude-code', 'anthropic-api', 'gemini-api'],
  edit: ['claude-code', 'anthropic-api', 'gemini-api'],
};

// AppSetting の項目名の頭（<頭>Provider / <頭>Model）
export const SETTING_KEY: Record<AiPurpose, string> = {
  research: 'aiResearch',
  script: 'aiScript',
  check: 'aiCheck',
  workshop: 'aiWorkshop',
  edit: 'aiEdit',
};

// 最初に入れておくモデル（モデルは空にしない。Antigravity は IDE で選ぶので渡せない）
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  'claude-code': 'claude-opus-5-5',
  antigravity: '',
  'anthropic-api': 'claude-opus-5-5',
  'gemini-api': 'gemini-3.8-flash',
};

// Claude Code で選べるモデル（2026-10-11 に1回ずつ呼んで確かめたもの）。
// 別名（sonnet / haiku）は古いモデル（Sonnet 5・Haiku 4.5）になるので出さない。Fable 5.1 は claude.ai の利用枠がなく使えなかったので出さない
export const CLAUDE_CODE_MODELS: { id: string; label: string }[] = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5（claude-opus-5-5）' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5（claude-sonnet-5-5）' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5（claude-haiku-5-5）' },
];

const API_KEY_ENV: Partial<Record<AiProvider, string>> = { 'anthropic-api': 'ANTHROPIC_API_KEY', 'gemini-api': 'GEMINI_API_KEY' };

export function apiKeyEnvName(provider: AiProvider): string | null {
  return API_KEY_ENV[provider] ?? null;
}

// ---------- 設定 ----------

// Claude Code・Antigravity を追加するときに最初に入れておく場所（環境変数 CLAUDE_BIN / ANTIGRAVITY_BIN があればそれ）
export const DEFAULT_CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(os.homedir(), '.local/bin/claude');
export const DEFAULT_ANTIGRAVITY_BIN = process.env.ANTIGRAVITY_BIN || path.join(os.homedir(), '.antigravity-ide/antigravity-ide/bin/antigravity-ide');

export async function loadAiSettings() {
  const s = (await prisma.appSetting.findUnique({ where: { id: 'app' } })) ?? (await prisma.appSetting.create({ data: { id: 'app' } }));
  // 選べない AI が入っていたら一覧の先頭に戻す。モデルが空（または AI を戻した）ならその AI の既定で埋める
  const pick = (purpose: AiPurpose) => {
    const key = SETTING_KEY[purpose];
    const provider = s[`${key}Provider` as keyof typeof s] as string;
    const model = s[`${key}Model` as keyof typeof s] as string;
    const ok = (PURPOSE_PROVIDERS[purpose] as string[]).includes(provider);
    const p = ok ? (provider as AiProvider) : PURPOSE_PROVIDERS[purpose][0];
    return { provider: p, model: (ok && model) || DEFAULT_MODEL[p] };
  };
  // API 以外の AI は「AI 連携」で登録したものだけを使う（登録していなければ null）
  const local = await prisma.localAiEntry.findMany();
  return {
    research: pick('research'),
    script: pick('script'),
    check: pick('check'),
    workshop: pick('workshop'),
    edit: pick('edit'),
    claudeBin: local.find((l) => l.kind === 'claude-code')?.binPath ?? null,
    antigravityBin: local.find((l) => l.kind === 'antigravity')?.binPath ?? null,
  };
}

export type AiSettings = Awaited<ReturnType<typeof loadAiSettings>>;

/** その AI を今使える状態か（API 以外は登録済み、API はキーがある）。使えなければ理由を返す */
export function providerProblem(provider: AiProvider, s: AiSettings): string | null {
  if (provider === 'claude-code') return s.claudeBin ? null : 'Claude Code が登録されていません（AI 連携の「API 以外」で追加してください）';
  if (provider === 'antigravity') return s.antigravityBin ? null : 'Antigravity が登録されていません（AI 連携の「API 以外」で追加してください）';
  const env = API_KEY_ENV[provider]!;
  return process.env[env] ? null : `${PROVIDER_LABEL[provider]} の API キー（${env}）がありません（AI 連携の「API」で追加してください）`;
}

/**
 * 用途で選べる AI とモデル（今使えるものだけ。登録していない AI・キーのない API は出さない）。
 * 今の設定の AI が使えなくなっていたら provider は null（画面で選び直してもらう）
 */
export async function purposeChoices(purpose: AiPurpose, s: AiSettings) {
  const usable = PURPOSE_PROVIDERS[purpose].filter((p) => providerProblem(p, s) === null);
  const models = Object.fromEntries(await Promise.all(usable.map(async (p) => [p, await modelOptions(p)] as const))) as Record<string, ModelOption[]>;
  // AI を選び直したときに入れるモデル（既定が一覧にあればそれ、なければ一覧の先頭）
  const defaults = Object.fromEntries(usable.map((p) => [p, models[p].some((m) => m.id === DEFAULT_MODEL[p]) ? DEFAULT_MODEL[p] : models[p][0]?.id ?? ''])) as Record<string, string>;
  const current = s[purpose];
  const provider = usable.includes(current.provider) ? current.provider : null;
  // 今のモデルが一覧になければ、その AI の既定を選んだ状態にする
  const model = provider ? (models[provider].some((m) => m.id === current.model) ? current.model : defaults[provider]) : '';
  return {
    providers: usable.map((p) => ({ id: p, label: PROVIDER_LABEL[p] })),
    models,
    defaults,
    provider,
    model,
    unavailable: provider ? null : PROVIDER_LABEL[current.provider],
  };
}

export async function chatAiOptions(purpose: ChatPurpose, s: AiSettings) {
  return purposeChoices(purpose, s);
}

const MODEL_NAME = /^[A-Za-z0-9._:/-]{1,100}$/;

/** 用途に AI とモデルを割り当てるときの検査（今使える AI と、その AI の選択肢にあるモデルだけ） */
export async function validateAssignment(purpose: AiPurpose, provider: string, model: string, s: AiSettings): Promise<string | null> {
  if (!(PURPOSE_PROVIDERS[purpose] as string[]).includes(provider)) return `${PURPOSE_LABEL[purpose]}には使えない AI です`;
  const problem = providerProblem(provider as AiProvider, s);
  if (problem) return problem;
  if (!model) return `${PURPOSE_LABEL[purpose]}のモデルを選んでください`;
  if (!MODEL_NAME.test(model)) return 'モデル名に使えない文字が含まれています';
  if (!(await modelOptions(provider as AiProvider)).some((m) => m.id === model)) return `${model} は ${PROVIDER_LABEL[provider as AiProvider]} で選べないモデルです`;
  return null;
}

// ---------- API 以外の AI（「AI 連携」→ API 以外） ----------

export const LOCAL_KINDS = ['claude-code', 'antigravity'] as const;
export type LocalAiKind = (typeof LOCAL_KINDS)[number];
export const LOCAL_DEFAULT_BIN: Record<LocalAiKind, string> = { 'claude-code': DEFAULT_CLAUDE_BIN, antigravity: DEFAULT_ANTIGRAVITY_BIN };

export function validateLocalAi(kind: string, label: string, binPath: string): string | null {
  if (!(LOCAL_KINDS as readonly string[]).includes(kind)) return '種類を選んでください';
  if (!label || label.length > 40) return '名前は1〜40文字で入力してください';
  if (!binPath.startsWith('/')) return '場所は / から始まる絶対パスで入力してください';
  if (!fs.existsSync(binPath)) return `その場所にファイルがありません: ${binPath}`;
  return null;
}

// ---------- API キー（「AI 連携」→ API） ----------

/** 環境変数名から、そのキーを使う AI（このサービスが使わないキーなら null） */
export function providerForEnv(envName: string): AiProvider | null {
  return (Object.entries(API_KEY_ENV) as [AiProvider, string][]).find(([, e]) => e === envName)?.[0] ?? null;
}

// サービス自身が使っている環境変数は、ここから登録・上書きできないようにする
const RESERVED_ENV = /^(YOUTUBE_|INTERNAL_API_TOKEN$|NEXT_|NODE_|DATABASE_|CLAUDE_BIN$|ANTIGRAVITY_BIN$|VOICEVOX_|REMOTION_|AGENT_)/;

export function validateApiKeyEntry(label: string, envName: string, value: string): string | null {
  if (!label || label.length > 40) return '名前は1〜40文字で入力してください';
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(envName)) return '環境変数名は半角の英大文字・数字・_ で入力してください（例: ANTHROPIC_API_KEY）';
  if (RESERVED_ENV.test(envName)) return 'この環境変数名はサービスが使っているため登録できません';
  if (!value || value.length > 500 || /["\s]/.test(value)) return '値が正しくありません（空白や " は使えません）';
  return null;
}

export type ApiKeyRow = { label: string; envName: string; masked: string | null; usedBy: string | null };

/** Antigravity が起動できるか確かめる（IDE のチャットで動くため、AI の応答までは確かめられない） */
export async function checkAntigravity(settings: AiSettings): Promise<string> {
  if (!settings.antigravityBin) throw new Error('Antigravity が登録されていません');
  const version = await run(settings.antigravityBin, ['--version']);
  if (!version.ok) throw new Error(`起動できませんでした（${settings.antigravityBin}）`);
  return version.stdout.trim().split('\n')[0];
}

/** 登録した API キーの一覧。.env.local に直接書いた Claude API・Gemini API のキーも並べる */
export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const entries = await prisma.apiKeyEntry.findMany({ orderBy: { createdAt: 'asc' } });
  const rows = entries.map((e) => ({ label: e.label, envName: e.envName }));
  for (const [provider, env] of Object.entries(API_KEY_ENV) as [AiProvider, string][]) {
    if (process.env[env] && !rows.some((r) => r.envName === env)) rows.push({ label: PROVIDER_LABEL[provider], envName: env });
  }
  return rows.map((r) => {
    const value = process.env[r.envName];
    const provider = providerForEnv(r.envName);
    return { ...r, masked: value ? `…${value.slice(-4)}` : null, usedBy: provider ? PROVIDER_LABEL[provider] : null };
  });
}

// ---------- 状態 ----------

function run(bin: string, args: string[], timeoutMs = 15000): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: timeoutMs, cwd: os.tmpdir() }, (error, stdout) => resolve({ ok: !error, stdout: String(stdout) }));
  });
}

export type ProviderStatus = {
  provider: AiProvider;
  ready: boolean; // 使える状態か
  summary: string; // 状態のひとこと
  details: { label: string; value: string }[];
};

export async function providerStatus(provider: AiProvider, settings: AiSettings): Promise<ProviderStatus> {
  if (provider === 'claude-code') {
    if (!settings.claudeBin) return { provider, ready: false, summary: '未登録', details: [] };
    if (!fs.existsSync(settings.claudeBin)) {
      return { provider, ready: false, summary: '見つかりません', details: [{ label: '場所', value: settings.claudeBin }] };
    }
    const [version, auth] = await Promise.all([run(settings.claudeBin, ['--version']), run(settings.claudeBin, ['auth', 'status'])]);
    let loggedIn = false;
    let method = '';
    try {
      // メールアドレスなどは出さない。ログインの有無と方法だけ
      const a = JSON.parse(auth.stdout) as { loggedIn?: boolean; authMethod?: string };
      loggedIn = Boolean(a.loggedIn);
      method = a.authMethod ?? '';
    } catch {
      // 古い版などで JSON が返らない
    }
    return {
      provider,
      ready: loggedIn,
      summary: loggedIn ? 'ログイン済み' : 'ログインしていません',
      details: [
        { label: '場所', value: settings.claudeBin },
        { label: 'バージョン', value: version.stdout.trim() || '-' },
        { label: 'ログイン', value: loggedIn ? `済み（${method || '不明'}）` : 'していない' },
      ],
    };
  }
  if (provider === 'antigravity') {
    if (!settings.antigravityBin) return { provider, ready: false, summary: '未登録', details: [] };
    if (!fs.existsSync(settings.antigravityBin)) {
      return { provider, ready: false, summary: '見つかりません', details: [{ label: '場所', value: settings.antigravityBin }] };
    }
    const version = await run(settings.antigravityBin, ['--version']);
    return {
      provider,
      ready: true,
      summary: 'インストール済み',
      details: [
        { label: '場所', value: settings.antigravityBin },
        { label: 'バージョン', value: version.stdout.trim().split('\n')[0] || '-' },
      ],
    };
  }
  const env = apiKeyEnvName(provider)!;
  const key = process.env[env];
  return {
    provider,
    ready: Boolean(key),
    summary: key ? 'API キー設定済み' : 'API キーが未設定です',
    // キーは末尾4文字だけ見せる
    details: [{ label: 'API キー', value: key ? `…${key.slice(-4)}（${env}）` : `未設定（${env}）` }],
  };
}

// ---------- モデル一覧 ----------

export type ModelOption = { id: string; label: string };

// API のモデル一覧は、画面を開くたびに問い合わせないよう10分だけ覚えておく（チャットの画面は数秒ごとに読み直すため）
const modelCache = new Map<AiProvider, { at: number; models: ModelOption[] }>();
const MODEL_CACHE_MS = 10 * 60 * 1000;

/** 選択肢に出すモデル（使えるものだけ）。API の一覧が取れなければ既定のモデルだけ */
export async function modelOptions(provider: AiProvider): Promise<ModelOption[]> {
  if (provider === 'claude-code') return CLAUDE_CODE_MODELS;
  if (provider === 'antigravity') return [];
  const cached = modelCache.get(provider);
  if (cached && Date.now() - cached.at < MODEL_CACHE_MS) return cached.models;
  const models = await listModels(provider).catch(() => []);
  const out = models.length > 0 ? models : [{ id: DEFAULT_MODEL[provider], label: DEFAULT_MODEL[provider] }];
  if (models.length > 0) modelCache.set(provider, { at: Date.now(), models: out });
  return out;
}

export async function listModels(provider: AiProvider): Promise<ModelOption[]> {
  if (provider === 'claude-code') return CLAUDE_CODE_MODELS;
  if (provider === 'antigravity') return [];
  if (provider === 'anthropic-api') {
    if (!process.env.ANTHROPIC_API_KEY) return [];
    const client = new Anthropic();
    const out: { id: string; label: string }[] = [];
    for await (const m of client.models.list()) out.push({ id: m.id, label: m.display_name ? `${m.display_name}（${m.id}）` : m.id });
    return out;
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw new Error(`Gemini のモデル一覧を取れませんでした（${res.status}）`);
  const data = (await res.json()) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return { id, label: m.displayName ? `${m.displayName}（${id}）` : id };
    });
}

// ---------- 呼び出し（JSON スキーマどおりの答えを受け取る） ----------

const TIMEOUT_MS = 5 * 60 * 1000;

export class AiTimeoutError extends Error {}

/** 用途に割り当てた AI を呼ぶ */
export async function runAiJson<T>(purpose: AiPurpose, systemPrompt: string, prompt: string, schema: object): Promise<T> {
  const settings = await loadAiSettings();
  const { provider, model } = settings[purpose];
  return runProviderJson<T>(provider, model, systemPrompt, prompt, schema, settings);
}

/** AI を指定して呼ぶ（接続テストにも使う）。答えが返らなかったときは1回だけやり直す（時間切れは除く） */
export async function runProviderJson<T>(
  provider: AiProvider,
  model: string,
  systemPrompt: string,
  prompt: string,
  schema: object,
  settings?: AiSettings
): Promise<T> {
  const s = settings ?? (await loadAiSettings());
  const once = () => {
    if (provider === 'claude-code') {
      if (!s.claudeBin) throw new Error('Claude Code が登録されていません（AI 連携の「API 以外」で追加してください）');
      return claudeCodeJson<T>(s.claudeBin, model, systemPrompt, prompt, schema);
    }
    if (provider === 'anthropic-api') return anthropicJson<T>(model || DEFAULT_MODEL['anthropic-api'], systemPrompt, prompt, schema);
    if (provider === 'gemini-api') return geminiJson<T>(model || DEFAULT_MODEL['gemini-api'], systemPrompt, prompt, schema);
    throw new Error(`${PROVIDER_LABEL[provider]} は、この用途には使えません`);
  };
  try {
    return await once();
  } catch (error) {
    // 構造化された答えがまれに返らないことがある（2026-10-10 に Claude Code で1回確認）
    if (error instanceof AiTimeoutError) throw error;
    return once();
  }
}

/**
 * Claude Code を「ツールなしの会話相手」として呼ぶ。既定のシステムプロンプト・設定ファイル・MCP サーバーを読まないようにして、軽く速く動かす
 * （既定のままだと、あいさつ1回でも大量の前提を読み込むため。2026-10-10 に計測: 約1.5ドル → 約0.01ドル）。
 */
function claudeCodeJson<T>(bin: string, model: string, systemPrompt: string, prompt: string, schema: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      [
        '-p', prompt,
        '--system-prompt', systemPrompt,
        '--tools', '',
        '--strict-mcp-config',
        '--setting-sources', '',
        '--output-format', 'json',
        '--json-schema', JSON.stringify(schema),
        '--no-session-persistence',
        ...(model ? ['--model', model] : []),
      ],
      // ツールを使わないので作業フォルダは問わない。リポジトリの CLAUDE.md なども読ませない
      { cwd: os.tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Claude Code を起動できませんでした（${bin}）: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === null) return reject(new AiTimeoutError('時間切れになりました（5分）'));
      try {
        const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; subtype?: string; structured_output?: T };
        if (out.is_error || out.structured_output === undefined) {
          throw new Error(`答えを受け取れませんでした（${out.subtype ?? '不明'}${out.result ? `: ${out.result.slice(0, 200)}` : ''}）`);
        }
        resolve(out.structured_output);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        reject(new Error(`${detail}${stderr ? ` / ${stderr.slice(-300)}` : ''}`));
      }
    });
  });
}

/** Claude API（構造化出力: output_config.format） */
async function anthropicJson<T>(model: string, systemPrompt: string, prompt: string, schema: object): Promise<T> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Claude API の API キーが未設定です（AI 連携の画面で設定してください）');
  const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 2 });
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new AiTimeoutError('時間切れになりました（5分）');
    if (error instanceof Anthropic.AuthenticationError) throw new Error('Claude API の API キーが正しくありません');
    if (error instanceof Anthropic.RateLimitError) throw new Error('Claude API の利用上限に達しました。少し待ってからやり直してください');
    if (error instanceof Anthropic.APIError) throw new Error(`Claude API のエラー（${error.status}）: ${error.message}`);
    throw error;
  }
  if (response.stop_reason === 'refusal') throw new Error('Claude API が答えを断りました（内容を変えてやり直してください）');
  if (response.stop_reason === 'max_tokens') throw new Error('答えが長すぎて途中で切れました');
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return JSON.parse(text) as T;
}

/** Gemini API（generateContent の responseSchema） */
async function geminiJson<T>(model: string, systemPrompt: string, prompt: string, schema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini API の API キーが未設定です（AI 連携の画面で設定してください）');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) },
      }),
      signal: controller.signal,
    });
    const data = (await res.json()) as {
      error?: { message?: string };
      candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
    };
    if (!res.ok) throw new Error(`Gemini API のエラー（${res.status}）: ${data.error?.message ?? ''}`);
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error(`Gemini API から答えを受け取れませんでした（${candidate?.finishReason ?? '不明'}）`);
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new AiTimeoutError('時間切れになりました（5分）');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
