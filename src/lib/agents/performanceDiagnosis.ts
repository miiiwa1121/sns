import { PlatformType } from '@/lib/types';

// 画面（サーバーコンポーネント）と CriticAgent の両方から使うため、prisma を import しない純粋関数として置く。
// 実測値から計算できる事実だけを文章化し、測っていない因果（「フックが効いた」等）は書かない。

export interface PlatformMetricInput {
  platform: PlatformType;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagementRate: number; // %
  topComment?: string;
}

export interface MetricsInput {
  retentionRate: number | null; // %（どの媒体も未取得なら null）
  platforms: PlatformMetricInput[];
}

export interface DiagnosisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  // 再生数が少なすぎる場合は知見として保存しない
  actionableKnowledge: {
    category: 'hook' | 'tempo' | 'topic' | 'cta';
    ruleText: string;
    confidenceScore: number;
  } | null;
}

const PLATFORM_LABEL: Record<PlatformType, string> = {
  youtube: 'YouTube Shorts',
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
  x: 'X',
};

// 維持率は「取得できた媒体だけ」で再生数加重平均する。1媒体も無ければ null
export function weightedRetention(platforms: { views: number; retentionRate: number | null }[]): number | null {
  const known = platforms.filter((p) => p.retentionRate !== null && p.views > 0);
  const views = known.reduce((acc, p) => acc + p.views, 0);
  if (views === 0) return null;
  return Math.round((known.reduce((acc, p) => acc + (p.retentionRate as number) * p.views, 0) / views) * 10) / 10;
}

// この再生数未満では偏りが大きく、知見として残す価値がない
const MIN_VIEWS_FOR_KNOWLEDGE = 1000;

export function diagnosePerformance(videoTitle: string, metrics: MetricsInput): DiagnosisResult {
  const totalViews = metrics.platforms.reduce((acc, p) => acc + p.views, 0);
  const sorted = [...metrics.platforms].sort((a, b) => b.engagementRate - a.engagementRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const retention = metrics.retentionRate === null ? '未取得' : `${metrics.retentionRate}%`;
  const summary = `総再生数 ${totalViews.toLocaleString()}回・平均視聴維持率 ${retention}（${metrics.platforms.length}媒体の実測値）。`;

  if (!best || !worst) {
    return { summary, strengths: [], weaknesses: [], actionableKnowledge: null };
  }

  const strengths = [`エンゲージメント率が最も高いのは ${PLATFORM_LABEL[best.platform]}（${best.engagementRate}%）`];
  const weaknesses = best === worst
    ? []
    : [`エンゲージメント率が最も低いのは ${PLATFORM_LABEL[worst.platform]}（${worst.engagementRate}%）`];

  const actionableKnowledge = totalViews >= MIN_VIEWS_FOR_KNOWLEDGE
    ? {
        category: 'topic' as const,
        ruleText: `【${videoTitle.slice(0, 20)}】実測: ${PLATFORM_LABEL[best.platform]} のエンゲージメント率 ${best.engagementRate}% が最高、${PLATFORM_LABEL[worst.platform]} ${worst.engagementRate}% が最低（総再生 ${totalViews.toLocaleString()}回）`,
        // 単発動画の観測値なので、再生数に応じて 0.3〜0.8 の範囲に留める
        confidenceScore: Math.min(0.8, 0.3 + Math.log10(totalViews / MIN_VIEWS_FOR_KNOWLEDGE + 1) * 0.25),
      }
    : null;

  return { summary, strengths, weaknesses, actionableKnowledge };
}
