import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { toGeminiSchema } from '@/lib/ai/schemas';

/**
 * 連携している AI（管理画面の「AI 連携」）。
 *   claude-code   : Claude Code（CLI。claude.ai へのログインで動く）。依頼・相談・編集のすべてに使える
 *   antigravity   : Antigravity IDE（IDE のチャットに依頼を送る）。動画づくりの依頼だけ
 *   anthropic-api : Claude API（API キー・従量課金）。相談・編集に使える
 *   gemini-api    : Gemini API（API キー・従量課金）。相談・編集に使える
 * 依頼（リサーチ → 台本 → 制作を自分で進めるエージェント）は、今は Claude Code と Antigravity だけが対応している。
 */

export type AiProvider = 'claude-code' | 'antigravity' | 'anthropic-api' | 'gemini-api';
export type AiPurpose = 'job' | 'workshop' | 'edit';

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  'claude-code': 'Claude Code',
  antigravity: 'Antigravity（Gemini）',
  'anthropic-api': 'Claude API',
  'gemini-api': 'Gemini API',
};

export const PURPOSE_LABEL: Record<AiPurpose, string> = {
  job: '動画づくりの依頼（既定）',
  workshop: '構成案の相談・試作',
  edit: '動画編集の手直し',
};

// 用途ごとに選べる AI
export const PURPOSE_PROVIDERS: Record<AiPurpose, AiProvider[]> = {
  job: ['claude-code', 'antigravity'],
  workshop: ['claude-code', 'anthropic-api', 'gemini-api'],
  edit: ['claude-code', 'anthropic-api', 'gemini-api'],
};

// モデルを空にしたときに使うもの（Claude Code・Antigravity は各ツールの既定に任せる）
export const DEFAULT_MODEL: Record<AiProvider, string> = {
  'claude-code': '',
  antigravity: '',
  'anthropic-api': 'claude-opus-5-5',
  'gemini-api': 'gemini-3.8-flash',
};

// Claude Code の --model に渡せる名前（別名。具体的なモデル ID も渡せる）
export const CLAUDE_CODE_MODELS = ['opus', 'sonnet', 'haiku', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

const API_KEY_ENV: Partial<Record<AiProvider, string>> = { 'anthropic-api': 'ANTHROPIC_API_KEY', 'gemini-api': 'GEMINI_API_KEY' };

export function apiKeyEnvName(provider: AiProvider): string | null {
  return API_KEY_ENV[provider] ?? null;
}

// ---------- 設定 ----------

// 置き場所を設定していないときに使う場所（環境変数 CLAUDE_BIN / ANTIGRAVITY_BIN があればそれ）
export const DEFAULT_CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(os.homedir(), '.local/bin/claude');
export const DEFAULT_ANTIGRAVITY_BIN = process.env.ANTIGRAVITY_BIN || path.join(os.homedir(), '.antigravity-ide/antigravity-ide/bin/antigravity-ide');

export async function loadAiSettings() {
  const s = (await prisma.appSetting.findUnique({ where: { id: 'app' } })) ?? (await prisma.appSetting.create({ data: { id: 'app' } }));
  const pick = (purpose: AiPurpose, provider: string, model: string) => {
    const p = (PURPOSE_PROVIDERS[purpose] as string[]).includes(provider) ? (provider as AiProvider) : PURPOSE_PROVIDERS[purpose][0];
    return { provider: p, model };
  };
  return {
    job: pick('job', s.aiJobProvider, s.aiJobModel),
    workshop: pick('workshop', s.aiWorkshopProvider, s.aiWorkshopModel),
    edit: pick('edit', s.aiEditProvider, s.aiEditModel),
    claudeBin: s.claudeBinPath || DEFAULT_CLAUDE_BIN,
    antigravityBin: s.antigravityBinPath || DEFAULT_ANTIGRAVITY_BIN,
    claudeBinPath: s.claudeBinPath,
    antigravityBinPath: s.antigravityBinPath,
  };
}

export type AiSettings = Awaited<ReturnType<typeof loadAiSettings>>;

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
      summary: loggedIn ? 'ログイン済み' : 'ログインしていません（ターミナルで claude を起動してログイン）',
      details: [
        { label: '場所', value: settings.claudeBin },
        { label: 'バージョン', value: version.stdout.trim() || '-' },
        { label: 'ログイン', value: loggedIn ? `済み（${method || '不明'}）` : 'していない' },
      ],
    };
  }
  if (provider === 'antigravity') {
    if (!fs.existsSync(settings.antigravityBin)) {
      return { provider, ready: false, summary: '見つかりません', details: [{ label: '場所', value: settings.antigravityBin }] };
    }
    const version = await run(settings.antigravityBin, ['--version']);
    return {
      provider,
      ready: true,
      summary: 'インストール済み（ログインは IDE で行います）',
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

export async function listModels(provider: AiProvider): Promise<{ id: string; label: string }[]> {
  if (provider === 'claude-code') return CLAUDE_CODE_MODELS.map((m) => ({ id: m, label: m }));
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
    if (provider === 'claude-code') return claudeCodeJson<T>(s.claudeBin, model, systemPrompt, prompt, schema);
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
