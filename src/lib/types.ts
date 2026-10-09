export type PlatformType = 'youtube' | 'tiktok' | 'instagram' | 'x';

export type PipelineStage = 'research' | 'production' | 'review' | 'published' | 'analyzed';

export type VideoFormat = 'long' | 'short';

export interface TrendItem {
  id: string;
  topic: string;
  category: string;
  platforms: PlatformType[];
  buzzScore: number | null; // 0 - 100（実測できない場合は null）
  searchVolume: string | null;
  trendVelocity: string | null;
  sentiment: 'positive' | 'neutral' | 'curious';
  suggestedAngle: string;
}

export interface HighlightClip {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number;
  hookHookSentence: string;
  targetPlatforms: PlatformType[];
  aspectRatio: '9:16';
  captionStyle: 'dynamic-bounce' | 'neon-glow' | 'minimal-clean';
  estimatedRetentionRate: number; // e.g. 78%
  bgmTrack: string;
  readyToPublish: boolean;
}

export interface VideoProject {
  id: string;
  title: string;
  concept: string;
  stage: PipelineStage;
  targetAudience: string;
  estimatedViews: string;
  createdAt: string;
  updatedAt: string;
  
  // 長尺動画（Long-form）詳細
  longForm: {
    title: string;
    description: string;
    duration: number; // in seconds (e.g. 600 = 10 min)
    thumbnailUrl: string;
    status: 'drafting' | 'rendered' | 'approved' | 'published';
    script: {
      section: string;
      narration: string;
      visualCue: string;
      durationSec: number;
    }[];
  };

  // 切り抜きショート動画（Shorts）リスト
  shortClips: HighlightClip[];

  // プラットフォーム別配信メタデータ
  publishingMetadata: {
    youtube: {
      title: string;
      tags: string[];
      visibility: 'public' | 'unlisted' | 'private';
      scheduledAt?: string;
      published: boolean;
    };
    tiktok: {
      caption: string;
      hashtags: string[];
      privacyLevel: 'public_to_everyone';
      published: boolean;
    };
    instagram: {
      caption: string;
      coverFrameSec: number;
      shareToFeed: boolean;
      published: boolean;
    };
    x: {
      postText: string;
      published: boolean;
    };
  };

  // アナリティクス結果（投稿後）
  analytics?: {
    totalViews: number;
    retentionRate: number | null; // %（未取得なら null）
    totalLikes: number;
    totalShares: number;
    totalComments: number;
    platformBreakdown: {
      platform: PlatformType;
      views: number;
      engagementRate: number; // %
      topComment?: string;
    }[];
    aiDiagnosis: {
      summary: string;
      strengths: string[];
      weaknesses: string[];
      // 再生数が少なく知見化できない場合は undefined
      actionableFeedbackForNext?: string;
    };
  };
}

export interface AgentLog {
  id: string;
  timestamp: string;
  agentName: 'TrendScout' | 'ScriptMaster' | 'ClipCutter' | 'Dispatcher' | 'CriticAI';
  level: 'info' | 'success' | 'warning';
  message: string;
}

export interface SystemStats {
  autonomousMode: boolean;
  activeProjects: number;
  totalViewsGenerated: string;
  avgEngagementRate: string;
  scheduledQueueCount: number;
}
