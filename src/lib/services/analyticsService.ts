import { prisma } from '@/lib/prisma';
import { CriticAgent } from '@/lib/agents/criticAgent';
import { DiagnosisResult, PlatformMetricInput, weightedRetention } from '@/lib/agents/performanceDiagnosis';
import { PlatformType } from '@/lib/types';

const PLATFORMS: PlatformType[] = ['youtube', 'tiktok', 'instagram', 'x'];

export interface PlatformMetricRecord extends PlatformMetricInput {
  retentionRate: number | null; // %（未取得なら null）
}

/**
 * 実測値を保存する。送られたプラットフォームの値だけを置き換え、他のプラットフォームの値は残す
 * （YouTube は API で自動取得、他は手動入力、のように取得経路が混在するため）。
 * 配信済みでないプラットフォームの値は受け付けない（エラーメッセージを返す）。
 */
export async function recordMetrics(projectId: string, platforms: PlatformMetricRecord[]): Promise<string | null> {
  const published = await prisma.publishLog.findMany({
    where: { projectId, status: 'published' },
    select: { platform: true },
  });
  const unpublished = platforms.filter((p) => !published.some((l) => l.platform === p.platform));
  if (unpublished.length > 0) {
    return `配信済みでないプラットフォームの実測値は登録できません: ${unpublished.map((p) => p.platform).join(', ')}`;
  }

  await prisma.$transaction([
    prisma.analyticsMetric.deleteMany({
      where: { projectId, platform: { in: platforms.map((p) => p.platform) } },
    }),
    ...platforms.map((p) =>
      prisma.analyticsMetric.create({
        data: {
          projectId,
          platform: p.platform,
          views: p.views,
          retentionRate: p.retentionRate,
          likes: p.likes,
          shares: p.shares,
          comments: p.comments,
          engagementRate: p.engagementRate,
          topComment: p.topComment,
        },
      })
    ),
  ]);
  return null;
}

export type AnalyzeOutcome =
  | { ok: false; httpStatus: number; error: string }
  | { ok: true; diagnosis: DiagnosisResult; persistedKnowledge: Awaited<ReturnType<typeof CriticAgent.persistKnowledge>> | null };

/**
 * DB に登録済みの実測値で診断し、必要なら知見として保存する。実測値が無ければ分析しない。
 */
export async function analyzeProject(projectId: string, applyToKnowledge: boolean): Promise<AnalyzeOutcome> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { analytics: true },
  });
  if (!project) {
    return { ok: false, httpStatus: 404, error: '指定されたプロジェクトが見つかりません' };
  }
  if (project.analytics.length === 0) {
    return { ok: false, httpStatus: 400, error: 'このプロジェクトには実測アナリティクスが登録されていません' };
  }

  const platforms = project.analytics.map((a) => ({
    platform: a.platform as PlatformType,
    views: a.views,
    likes: a.likes,
    shares: a.shares,
    comments: a.comments,
    engagementRate: a.engagementRate,
    retentionRate: a.retentionRate,
    topComment: a.topComment ?? undefined,
  }));
  const retentionRate = weightedRetention(platforms);

  const diagnosis = CriticAgent.analyzePerformance({
    accountId: project.accountId,
    projectId: project.id,
    videoTitle: project.title,
    metrics: { retentionRate, platforms },
  });

  let persistedKnowledge = null;
  if (applyToKnowledge && diagnosis.actionableKnowledge) {
    // 保存先はプロジェクトの所属アカウント（クライアント入力は使わない）
    persistedKnowledge = await CriticAgent.persistKnowledge(project.accountId, diagnosis.actionableKnowledge);
  }
  if (project.stage === 'published') {
    await prisma.project.update({ where: { id: project.id }, data: { stage: 'analyzed' } });
  }

  return { ok: true, diagnosis, persistedKnowledge };
}

/**
 * 外部入力（API ボディ / CLI 引数）の実測値を検証する。不正ならエラーメッセージを返す。
 */
export function parsePlatformMetrics(input: unknown): PlatformMetricRecord[] | string {
  if (!Array.isArray(input) || input.length === 0) {
    return 'metrics.platforms は1件以上の配列で指定してください';
  }

  const result: PlatformMetricRecord[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return 'metrics.platforms の要素が不正です';
    const p = raw as Record<string, unknown>;
    if (!PLATFORMS.includes(p.platform as PlatformType)) {
      return `platform は ${PLATFORMS.join(' / ')} のいずれかです`;
    }
    if (p.retentionRate !== undefined && p.retentionRate !== null
      && (typeof p.retentionRate !== 'number' || !Number.isFinite(p.retentionRate) || p.retentionRate < 0 || p.retentionRate > 100)) {
      return `${p.platform}.retentionRate は0〜100の数値で指定してください（未取得なら省略）`;
    }
    for (const key of ['views', 'likes', 'shares', 'comments', 'engagementRate'] as const) {
      const v = p[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        return `${p.platform}.${key} は0以上の数値で指定してください`;
      }
    }
    if (result.some((r) => r.platform === p.platform)) {
      return `${p.platform} が重複しています`;
    }
    result.push({
      platform: p.platform as PlatformType,
      views: p.views as number,
      likes: p.likes as number,
      shares: p.shares as number,
      comments: p.comments as number,
      engagementRate: p.engagementRate as number,
      retentionRate: typeof p.retentionRate === 'number' ? p.retentionRate : null,
      topComment: typeof p.topComment === 'string' ? p.topComment : undefined,
    });
  }
  return result;
}
