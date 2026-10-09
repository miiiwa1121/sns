// YouTube のリフレッシュトークンを取得して .env.local に保存する（初回のみ・ユーザーがブラウザで許可する）。
// 事前に Google Cloud Console で「デスクトップアプリ」型の OAuth クライアントを作り、
// YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET を .env.local に書いておくこと。
import './env';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import { google } from 'googleapis';
import { YOUTUBE_REDIRECT_URI, YOUTUBE_SCOPES } from '../../src/lib/publishers/youtubePublisher';

const ENV_FILE = '.env.local';

async function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('❌ .env.local に YOUTUBE_CLIENT_ID と YOUTUBE_CLIENT_SECRET を設定してください');
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, YOUTUBE_REDIRECT_URI);
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // 毎回リフレッシュトークンを発行させる
    scope: YOUTUBE_SCOPES,
    state,
  });

  const redirect = new URL(YOUTUBE_REDIRECT_URI);
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', YOUTUBE_REDIRECT_URI);
      if (url.pathname !== redirect.pathname) {
        res.writeHead(404).end();
        return;
      }
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(ok ? '認証が完了しました。このタブは閉じて構いません。' : '認証に失敗しました（state 不一致またはコードなし）');
      server.close();
      if (ok) resolve(url.searchParams.get('code') as string);
      else reject(new Error(url.searchParams.get('error') ?? 'state 不一致'));
    });
    server.listen(Number(redirect.port), redirect.hostname, () => {
      console.log('次の URL をブラウザで開き、運用チャンネル（ついていくのが精一杯）のアカウントで許可してください:\n');
      console.log(authUrl + '\n');
    });
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error('❌ リフレッシュトークンが返りませんでした。Google アカウントの「サードパーティ アクセス」から一度削除して再実行してください');
    process.exit(1);
  }

  // どのチャンネルで認証したかを確認する（別チャンネルへの誤投稿防止）
  oauth2.setCredentials(tokens);
  const channels = await google.youtube({ version: 'v3', auth: oauth2 }).channels.list({ part: ['snippet'], mine: true });
  const channel = channels.data.items?.[0];
  console.log(`📺 認証したチャンネル: ${channel?.snippet?.title ?? '(不明)'} (${channel?.id ?? '-'})`);

  // 既存の値を置き換えて保存。トークンは画面に出さない
  const current = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
  const line = `YOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"`;
  const next = /^YOUTUBE_REFRESH_TOKEN=.*$/m.test(current)
    ? current.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, line)
    : `${current.trimEnd()}\n${line}\n`.trimStart();
  fs.writeFileSync(ENV_FILE, next, { mode: 0o600 });
  console.log(`✅ リフレッシュトークンを ${ENV_FILE} に保存しました`);
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
