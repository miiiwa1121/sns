import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rejectCrossSite } from '@/lib/requestGuard';

/**
 * DB に登録済みのトレンドから、台本未作成の下書きプロジェクトを作る。
 * 台本・ショート・キャプションは後工程（台本生成・レンダリング）で埋める。ここでは架空の内容を入れない。
 */
export async function POST(req: Request) {
  const rejected = rejectCrossSite(req);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const { trendId } = body;

    if (!trendId || typeof trendId !== 'string') {
      return NextResponse.json({ success: false, error: 'trendId は必須です' }, { status: 400 });
    }

    const trend = await prisma.trendResearch.findUnique({
      where: { id: trendId },
      include: { account: true },
    });
    if (!trend) {
      return NextResponse.json({ success: false, error: '指定されたトレンドが見つかりません' }, { status: 404 });
    }

    const project = await prisma.project.create({
      data: {
        accountId: trend.accountId,
        title: trend.topic,
        concept: trend.suggestedAngle,
        stage: 'production',
        targetAudience: trend.account.targetAudience,
        longFormVideo: {
          create: {
            title: trend.topic,
            description: '',
            durationSec: 0,
            status: 'drafting',
            scriptJson: '[]',
          },
        },
        publishLogs: {
          create: [
            { platform: 'youtube' },
            { platform: 'tiktok' },
            { platform: 'instagram' },
            { platform: 'x' },
          ],
        },
      },
      include: {
        longFormVideo: true,
        shortClips: true,
        publishLogs: true,
        analytics: true,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ success: false, error: 'プロジェクトの作成に失敗しました' }, { status: 500 });
  }
}
