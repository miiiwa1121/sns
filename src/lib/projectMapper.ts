import { VideoProject, HighlightClip, PlatformType } from './types';

export function mapDbProjectToUi(dbProj: any): VideoProject {
  const longForm = dbProj.longFormVideo ? {
    title: dbProj.longFormVideo.title,
    description: dbProj.longFormVideo.description || '',
    duration: dbProj.longFormVideo.durationSec || 600,
    thumbnailUrl: dbProj.longFormVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    status: (dbProj.longFormVideo.status as any) || 'rendered',
    script: dbProj.longFormVideo.scriptJson ? JSON.parse(dbProj.longFormVideo.scriptJson) : []
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
      tags: ytLog?.tagsJson ? JSON.parse(ytLog.tagsJson) : ['AIエージェント', '最新トレンド', '自動化'],
      visibility: 'public' as const,
      published: ytLog?.status === 'published'
    },
    tiktok: {
      caption: ttLog?.caption || dbProj.concept,
      hashtags: ttLog?.tagsJson ? JSON.parse(ttLog.tagsJson) : ['AI活用', '神ツール', '動画制作'],
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
    estimatedViews: dbProj.estimatedViews || '100,000+',
    createdAt: new Date(dbProj.createdAt).toISOString().replace('T', ' ').substring(0, 16),
    updatedAt: new Date(dbProj.updatedAt || dbProj.createdAt).toISOString().replace('T', ' ').substring(0, 16),
    longForm,
    shortClips,
    publishingMetadata,
    analytics: dbProj.analytics && dbProj.analytics.length > 0 ? {
      totalViews: dbProj.analytics.reduce((acc: number, curr: any) => acc + curr.views, 0),
      retentionRate: dbProj.analytics[0]?.retentionRate || 75.0,
      totalLikes: dbProj.analytics.reduce((acc: number, curr: any) => acc + curr.likes, 0),
      totalShares: dbProj.analytics.reduce((acc: number, curr: any) => acc + curr.shares, 0),
      totalComments: dbProj.analytics.reduce((acc: number, curr: any) => acc + curr.comments, 0),
      platformBreakdown: dbProj.analytics.map((a: any) => ({
        platform: a.platform as PlatformType,
        views: a.views,
        engagementRate: a.engagementRate,
        topComment: a.topComment || undefined
      })),
      aiDiagnosis: {
        summary: '冒頭1.2秒の強烈なフック（否定形の疑問文）により、TikTokおよびYouTube Shortsでの初期離脱が大幅に改善。',
        strengths: ['フック部分のテロップに蛍光イエローのバウンス効果を採用したことで視線誘導に成功'],
        weaknesses: ['後半のまとめ部分で若干テンポが落ち、微小な離脱が発生している'],
        actionableFeedbackForNext: '次回はまとめパートにカウントダウンタイマーを挿入して最後まで見切らせる構成を推奨します。'
      }
    } : undefined
  };
}
