import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

const CLAUDE_BIN = process.env.CLAUDE_BIN || path.join(os.homedir(), '.local/bin/claude');
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Claude Code を「ツールなしの会話相手」として1回呼び、JSON スキーマどおりの答えを受け取る。
 * 既定のシステムプロンプト・設定ファイル・MCP サーバーを読まないようにして、軽く速く動かす
 * （既定のままだと、あいさつ1回でも大量の前提を読み込むため。2026-10-10 に計測: 約1.5ドル → 約0.01ドル）。
 */
export async function runClaudeJson<T>(systemPrompt: string, prompt: string, schema: object): Promise<T> {
  // 構造化された答えがまれに返らないことがある（2026-10-10 に1回確認）ため、時間切れ以外の失敗は1回だけやり直す
  try {
    return await runOnce<T>(systemPrompt, prompt, schema);
  } catch (error) {
    if (error instanceof TimeoutError) throw error;
    return runOnce<T>(systemPrompt, prompt, schema);
  }
}

class TimeoutError extends Error {}

function runOnce<T>(systemPrompt: string, prompt: string, schema: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      CLAUDE_BIN,
      [
        '-p', prompt,
        '--system-prompt', systemPrompt,
        '--tools', '',
        '--strict-mcp-config',
        '--setting-sources', '',
        '--output-format', 'json',
        '--json-schema', JSON.stringify(schema),
        '--no-session-persistence',
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
      reject(new Error(`Claude Code を起動できませんでした（${CLAUDE_BIN}）: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === null) return reject(new TimeoutError('時間切れになりました（5分）'));
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
