import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { OAUTH_STATE_COOKIE, browserOrigin, completeAuth } from '@/lib/youtubeAuth';

// Google の許可画面から戻ってくる。state を照合してから連携を保存し、アカウント画面に戻す
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = browserOrigin(request);
  const jar = await cookies();
  const [state, slug] = (jar.get(OAUTH_STATE_COOKIE)?.value ?? '').split('.');
  jar.delete({ name: OAUTH_STATE_COOKIE, path: '/api/youtube/oauth' });

  if (!state || !slug) return NextResponse.redirect(new URL('/accounts', origin));
  const back = (ok: boolean, message: string) =>
    NextResponse.redirect(new URL(`/accounts/${encodeURIComponent(slug)}?youtube=${ok ? 'ok' : 'error'}&message=${encodeURIComponent(message)}`, origin));

  if (url.searchParams.get('state') !== state) return back(false, '認証に失敗しました（やり直してください）');
  const code = url.searchParams.get('code');
  if (!code) return back(false, url.searchParams.get('error') === 'access_denied' ? '許可がキャンセルされました' : '認証に失敗しました（やり直してください）');

  try {
    const result = await completeAuth(slug, code, `${origin}/api/youtube/oauth/callback`);
    return result.ok ? back(true, `「${result.channelTitle}」と連携しました`) : back(false, result.error);
  } catch (error) {
    return back(false, `連携に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}
