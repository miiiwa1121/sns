import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CriticAgent } from '@/lib/agents/criticAgent';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'accountId は必須です' },
        { status: 400 }
      );
    }

    const knowledges = await prisma.agentKnowledge.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, knowledges });
  } catch (error: any) {
    console.error('Failed to get knowledges:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, accountId, metrics, applyToKnowledge } = body;

    if (!projectId || !accountId) {
      return NextResponse.json(
        { success: false, error: 'projectId と accountId は必須です' },
        { status: 400 }
      );
    }

    // 1. プロジェクトの取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        analytics: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: '指定されたプロジェクトが見つかりません' },
        { status: 404 }
      );
    }

    const defaultMetrics = {
      totalViews: 384000,
      retentionRate: 76.5,
      totalLikes: 32400,
      totalShares: 4800,
      totalComments: 1420,
      platforms: [
        { platform: 'youtube', views: 182000, engagementRate: 9.2, topComment: 'このシステム本当に一般公開してほしい！切り抜きのテンポ最高' },
        { platform: 'tiktok', views: 148000, engagementRate: 12.4, topComment: '最初の1秒で気になって最後まで見ちゃったw' },
        { platform: 'instagram', views: 36000, engagementRate: 6.8, topComment: '文字のバウンスアニメーション見やすいですね' },
        { platform: 'x', views: 18000, engagementRate: 5.1, topComment: 'RemotionとAIの組み合わせが凄い' },
      ],
    };

    const targetMetrics = metrics || defaultMetrics;

    // 2. CriticAI による要因分析
    const diagnosis = CriticAgent.analyzePerformance({
      accountId,
      projectId,
      videoTitle: project.title,
      metrics: targetMetrics,
    });

    // 3. SQLite DB へのアナリティクス指標の保存
    if (project.analytics.length === 0) {
      for (const p of targetMetrics.platforms) {
        await prisma.analyticsMetric.create({
          data: {
            projectId: project.id,
            platform: p.platform,
            views: p.views,
            retentionRate: targetMetrics.retentionRate,
            likes: Math.round(p.views * 0.08),
            shares: Math.round(p.views * 0.01),
            comments: Math.round(p.views * 0.003),
            engagementRate: p.engagementRate,
            topComment: p.topComment,
          },
        });
      }
    }

    // 4. 学習知見の蓄積 (AgentKnowledge テーブルへ反映)
    let persistedKnowledge = null;
    if (applyToKnowledge) {
      persistedKnowledge = await CriticAgent.persistKnowledge(accountId, diagnosis.actionableKnowledge);
    }

    return NextResponse.json({
      success: true,
      diagnosis,
      persistedKnowledge,
      message: 'アナリティクス分析およびCriticAIによる知見抽出が完了しました！',
    });
  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'アナリティクス分析中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
