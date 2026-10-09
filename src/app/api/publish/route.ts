import { NextResponse } from 'next/server';
import { rejectCrossSite } from '@/lib/requestGuard';
import { publishProject } from '@/lib/services/publishService';

export async function POST(req: Request) {
  const rejected = rejectCrossSite(req);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId は必須です' },
        { status: 400 }
      );
    }

    const outcome = await publishProject(projectId);
    if (!outcome.ok) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: outcome.httpStatus });
    }

    return NextResponse.json({
      // 1件も投稿できなかった場合だけ失敗扱い。一部成功は success: true + failed に内訳を返す
      success: outcome.succeeded.length > 0,
      allPublished: outcome.allPublished,
      succeeded: outcome.succeeded,
      failed: outcome.failed,
      error: outcome.succeeded.length === 0
        ? outcome.failed.map((f) => `${f.platform}: ${f.message}`).join(' / ')
        : undefined,
    });
  } catch (error) {
    console.error('Publish API error:', error);
    return NextResponse.json(
      { success: false, error: '配信処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
