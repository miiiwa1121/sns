import fs from 'fs';
import path from 'path';

// 認証情報は Git 管理外の .env.local に置く（DB には入れない）。管理画面から書き換えるときに使う。
const ENV_FILE = path.resolve(process.cwd(), '.env.local');

/**
 * .env.local の値を追加・置き換えし、動いているサーバーの process.env にもすぐ反映する（再起動しなくても使えるように）。
 * 値は画面やログに出さないこと。
 */
export function saveEnvValues(values: Record<string, string>): void {
  let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z0-9_]+$/.test(key)) throw new Error(`環境変数名が不正です: ${key}`);
    if (/["\n\r]/.test(value)) throw new Error(`${key} に使えない文字が含まれています`);
    const line = `${key}="${value}"`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`.trimStart();
    process.env[key] = value;
  }
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
}

/** .env.local から値を行ごと消し、動いているサーバーの process.env からも消す */
export function removeEnvValues(keys: string[]): void {
  if (!fs.existsSync(ENV_FILE)) return;
  let content = fs.readFileSync(ENV_FILE, 'utf-8');
  for (const key of keys) {
    if (!/^[A-Z0-9_]+$/.test(key)) throw new Error(`環境変数名が不正です: ${key}`);
    content = content.replace(new RegExp(`^${key}=.*(\\r?\\n|$)`, 'm'), '');
    delete process.env[key];
  }
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
}
