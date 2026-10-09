import { NextResponse } from 'next/server';
import { rejectWithoutInternalToken } from '@/lib/requestGuard';

/**
 * 完全自律サイクル（リサーチ→台本→レンダリング→投稿→分析→知見蓄積）。
 *
 * 以前はここで架空のトレンド・「配信済み」プロジェクト・架空の再生数を DB に書き込み、
 * それをもとに学習知見まで保存していた。実アカウントの知見を汚染するため撤去し、
 * 各工程が実データで動くようになるまで 501 を返す。
 */
export async function POST(req: Request) {
  const rejected = rejectWithoutInternalToken(req);
  if (rejected) return rejected;

  return NextResponse.json(
    {
      success: false,
      error: '完全自律サイクルは未実装です（トレンド取得・台本生成・レンダリング・投稿・実測分析の各工程が実データで動くまで無効）',
    },
    { status: 501 }
  );
}
