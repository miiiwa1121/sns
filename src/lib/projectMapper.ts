import { VideoProject, HighlightClip, PlatformType } from './types';
import { diagnosePerformance, weightedRetention } from './agents/performanceDiagnosis';

// 1行壊れた JSON でダッシュボード全体が落ちないよう、パース失敗時は fallback を返す
export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function mapDbProjectToUi(dbProj: any): VideoProject {
  const longForm = dbProj.longFormVideo ? {
    title: dbProj.longFormVideo.title,
    description: dbProj.longFormVideo.description || '',
    duration: dbProj.longFormVideo.durationSec ?? 0,
    thumbnailUrl: dbProj.longFormVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    status: (dbProj.longFormVideo.status as any) || 'rendered',
    script: safeJson(dbProj.longFormVideo.scriptJson, [])
  } : {
    title: dbProj.title,
    description: dbProj.concept,
    duration: 600,
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    status: 'drafting',
    script: []
  };

  const shortClips: HighlightClip[] = (dbProj.shortClips || []).map((sc: any) => ({
    id: sc.id,
    title: sc.title,
    startTime: sc.startTimeSec,
    endTime: sc.endTimeSec,
    duration: sc.durationSec,
    hookHookSentence: sc.hookSentence,
    targetPlatforms: ['youtube', 'tiktok', 'instagram', 'x'] as PlatformType[],
    aspectRatio: '9:16',
    captionStyle: sc.captionStyle || 'dynamic-bounce',
    estimatedRetentionRate: sc.estimatedRetentionRate || 85,
    bgmTrack: sc.bgmTrack || 'Cyberpunk Lo-Fi Beat #04',
    readyToPublish: sc.readyToPublish ?? true,
  }));

  // publishLogs mapping
  const ytLog = dbProj.publishLogs?.find((l: any) => l.platform === 'youtube');
  const ttLog = dbProj.publishLogs?.find((l: any) => l.platform === 'tiktok');
  const igLog = dbProj.publishLogs?.find((l: any) => l.platform === 'instagram');
  const xLog = dbProj.publishLogs?.find((l: any) => l.platform === 'x');

  const publishingMetadata = {
    youtube: {
      title: ytLog?.title || dbProj.title,
      tags: safeJson<string[]>(ytLog?.tagsJson, []),
      visibility: 'public' as const,
      published: ytLog?.status === 'published'
    },
    tiktok: {
      caption: ttLog?.caption || dbProj.concept,
      hashtags: safeJson<string[]>(ttLog?.tagsJson, []),
      privacyLevel: 'public_to_everyone' as const,
      published: ttLog?.status === 'published'
    },
    instagram: {
      caption: igLog?.caption || dbProj.concept,
      coverFrameSec: 2,
      shareToFeed: true,
      published: igLog?.status === 'published'
    },
    x: {
      postText: xLog?.caption || `${dbProj.title}\n\n動画で解説しました👇`,
      published: xLog?.status === 'published'
    }
  };

  return {
    id: dbProj.id,
    title: dbProj.title,
    concept: dbProj.concept,
    stage: dbProj.stage || 'production',
    targetAudience: dbProj.targetAudience || '20〜40代 ITビジネス層',
    estimatedViews: dbProj.estimatedViews || '-',
    createdAt: new Date(dbProj.createdAt).toISOString().replace('T', ' ').substring(0, 16),
    updatedAt: new Date(dbProj.updatedAt || dbProj.createdAt).toISOString().replace('T', ' ').substring(0, 16),
    longForm,
    shortClips,
    publishingMetadata,
    analytics: mapAnalytics(dbProj),
  };
}

function mapAnalytics(dbProj: any): VideoProject['analytics'] {
  const rows: any[] = dbProj.analytics || [];
  if (rows.length === 0) return undefined;

  const platforms = rows.map((a) => ({
    platform: a.platform as PlatformType,
    views: a.views,
    likes: a.likes,
    shares: a.shares,
    comments: a.comments,
    engagementRate: a.engagementRate,
    topComment: a.topComment || undefined,
  }));
  const totalViews = platforms.reduce((acc, p) => acc + p.views, 0);
  const retentionRate = weightedRetention(rows);
  const diagnosis = diagnosePerformance(dbProj.title, { retentionRate, platforms });

  return {
    totalViews,
    retentionRate,
    totalLikes: platforms.reduce((acc, p) => acc + p.likes, 0),
    totalShares: platforms.reduce((acc, p) => acc + p.shares, 0),
    totalComments: platforms.reduce((acc, p) => acc + p.comments, 0),
    platformBreakdown: platforms.map(({ platform, views, engagementRate, topComment }) => ({
      platform,
      views,
      engagementRate,
      topComment,
    })),
    aiDiagnosis: {
      summary: diagnosis.summary,
      strengths: diagnosis.strengths,
      weaknesses: diagnosis.weaknesses,
      actionableFeedbackForNext: diagnosis.actionableKnowledge?.ruleText,
    },
  };
}
