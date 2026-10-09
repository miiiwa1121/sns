import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rejectCrossSite } from '@/lib/requestGuard';
import { analyzeProject, parsePlatformMetrics, recordMetrics } from '@/lib/services/analyticsService';

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
  } catch (error) {
    console.error('Failed to get knowledges:', error);
    return NextResponse.json(
      { success: false, error: '知見の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 実測アナリティクスの登録と CriticAI 分析。
 * - body.metrics があれば、送られたプラットフォームの実測値を置き換えて保存する
 * - その後、DB に登録済みの実測値で分析する
 * - 実測値が1件も無ければ 400（架空の数値で補完しない）
 */
export async function POST(req: Request) {
  const rejected = rejectCrossSite(req);
  if (rejected) return rejected;

  try {
    const body = await req.json();
    const { projectId, metrics, applyToKnowledge } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId は必須です' },
        { status: 400 }
      );
    }

    if (metrics !== undefined) {
      const parsed = parsePlatformMetrics(metrics?.platforms);
      if (typeof parsed === 'string') {
        return NextResponse.json({ success: false, error: parsed }, { status: 400 });
      }
      const exists = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!exists) {
        return NextResponse.json({ success: false, error: '指定されたプロジェクトが見つかりません' }, { status: 404 });
      }
      const recordError = await recordMetrics(projectId, parsed);
      if (recordError) {
        return NextResponse.json({ success: false, error: recordError }, { status: 400 });
      }
    }

    const outcome = await analyzeProject(projectId, Boolean(applyToKnowledge));
    if (!outcome.ok) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: outcome.httpStatus });
    }

    return NextResponse.json({
      success: true,
      diagnosis: outcome.diagnosis,
      persistedKnowledge: outcome.persistedKnowledge,
      message: outcome.diagnosis.actionableKnowledge
        ? '実測アナリティクスの分析が完了しました'
        : '分析は完了しましたが、再生数が少ないため知見は保存していません',
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'アナリティクス分析中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
