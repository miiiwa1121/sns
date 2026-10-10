import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { saveEnvValues } from '@/lib/envFile';
import { YOUTUBE_SCOPES, youtubeTokenEnvName } from '@/lib/publishers/youtubePublisher';

/**
 * アカウントの YouTube 連携（OAuth）。管理画面のアカウント画面から始め、/api/youtube/oauth/callback に戻ってくる。
 * OAuth クライアントは「デスクトップアプリ」型。127.0.0.1 の任意のポート・パスに戻せるため、Google 側に戻り先の登録は要らない。
 */

export const OAUTH_STATE_COOKIE = 'yt_oauth_state';

/**
 * ブラウザが開いている URL の origin。request.url は Next.js がホストを localhost に正規化するため使わない
 * （127.0.0.1 で開いていると、戻り先が localhost になり state の cookie が届かない）
 */
export function browserOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  return `${url.protocol}//${host}`;
}

export function youtubeClientReady(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

function oauthClient(redirectUri: string) {
  return new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, redirectUri);
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  return oauthClient(redirectUri).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // 毎回リフレッシュトークンを発行させる
    scope: YOUTUBE_SCOPES,
    state,
  });
}

export type CompleteResult = { ok: true; channelTitle: string } | { ok: false; error: string };

/** 許可後に返ってきたコードでトークンを取り、認証したチャンネルを確かめてから保存する */
export async function completeAuth(accountSlug: string, code: string, redirectUri: string): Promise<CompleteResult> {
  const account = await prisma.account.findUnique({ where: { slug: accountSlug } });
  if (!account) return { ok: false, error: 'アカウントが見つかりません' };

  const oauth2 = oauthClient(redirectUri);
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    return { ok: false, error: 'リフレッシュトークンが返りませんでした。Google アカウントの「サードパーティ アクセス」からこのアプリを一度削除して、やり直してください' };
  }

  // どのチャンネルで認証したかを確認する（別チャンネルへの誤投稿防止）
  oauth2.setCredentials(tokens);
  const channels = await google.youtube({ version: 'v3', auth: oauth2 }).channels.list({ part: ['snippet'], mine: true });
  const channel = channels.data.items?.[0];
  if (!channel?.id) return { ok: false, error: 'YouTube チャンネルを取得できませんでした。チャンネル（ブランドアカウント）を選んで許可してください' };

  const other = await prisma.platformConnection.findFirst({
    where: { platform: 'youtube', accountId: { not: account.id }, apiConfig: { contains: channel.id } },
    include: { account: true },
  });
  if (other) return { ok: false, error: `このチャンネルは別のアカウント「${other.account.name}」に連携済みです。チャンネルを選び直してください` };

  saveEnvValues({ [youtubeTokenEnvName(account.slug)]: tokens.refresh_token });

  // アカウントの YouTube 連携として、チャンネルを記録する（投稿前の照合に使う）
  const channelTitle = channel.snippet?.title ?? '';
  const apiConfig = JSON.stringify({ channelId: channel.id, channelTitle });
  const conn = await prisma.platformConnection.findFirst({ where: { accountId: account.id, platform: 'youtube' } });
  if (conn) await prisma.platformConnection.update({ where: { id: conn.id }, data: { apiConfig, isConnected: true } });
  else await prisma.platformConnection.create({ data: { accountId: account.id, platform: 'youtube', handle: '', apiConfig, isConnected: true } });
  return { ok: true, channelTitle };
}
