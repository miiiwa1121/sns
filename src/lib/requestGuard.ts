import { NextResponse } from 'next/server';

/**
 * ブラウザのダッシュボードから呼ばれる書き込み系 API の入口チェック。
 * 開発サーバーは 127.0.0.1 にバインドしているが、それだけでは「閲覧中の別サイトから
 * localhost へ POST させる」CSRF を防げないため、同一オリジンと JSON ボディを必須にする。
 * 問題がなければ null、拒否する場合はそのまま返せるレスポンスを返す。
 */
export function rejectCrossSite(req: Request): NextResponse | null {
  // text/plain 等の「シンプルリクエスト」はプリフライト無しで他サイトから送れるため拒否する
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ success: false, error: 'Content-Type は application/json のみ受け付けます' }, { status: 415 });
  }

  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return NextResponse.json({ success: false, error: '別オリジンからのリクエストは受け付けません' }, { status: 403 });
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && hostOf(origin) !== host) {
    return NextResponse.json({ success: false, error: '別オリジンからのリクエストは受け付けません' }, { status: 403 });
  }

  return null;
}

// サンドボックス iframe などは "Origin: null" を送るため、パースできない値は不一致として扱う
function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * CRON など、ブラウザ以外から叩かれる API 用。INTERNAL_API_TOKEN 未設定なら常に拒否する（fail closed）。
 */
export function rejectWithoutInternalToken(req: Request): NextResponse | null {
  const expected = process.env.INTERNAL_API_TOKEN;
  const auth = req.headers.get('authorization');
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
