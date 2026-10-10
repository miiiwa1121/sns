import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAUTH_STATE_COOKIE, browserOrigin, buildAuthUrl, youtubeClientReady } from '@/lib/youtubeAuth';

// アカウント画面の「YouTube と連携する」から来る。state を cookie に置いて、Google の許可画面へ送る
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = browserOrigin(request);
  const slug = url.searchParams.get('account') ?? '';
  const back = (query: string) => NextResponse.redirect(new URL(`/accounts/${encodeURIComponent(slug)}?${query}`, origin));

  const account = await prisma.account.findUnique({ where: { slug } });
  if (!account) return NextResponse.redirect(new URL('/accounts', origin));
  if (!youtubeClientReady()) return back(`youtube=error&message=${encodeURIComponent('先に「設定」で YouTube API のクライアント ID とシークレットを保存してください')}`);

  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildAuthUrl(`${origin}/api/youtube/oauth/callback`, state));
  res.cookies.set(OAUTH_STATE_COOKIE, `${state}.${slug}`, { httpOnly: true, sameSite: 'lax', path: '/api/youtube/oauth', maxAge: 600 });
  return res;
}
