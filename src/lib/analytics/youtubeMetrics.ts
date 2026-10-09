import { google } from 'googleapis';
import { YouTubePublisher } from '@/lib/publishers/youtubePublisher';
import { PlatformMetricRecord } from '@/lib/services/analyticsService';

/**
 * YouTube の実測値を取得する。
 * - 再生数・高評価・コメント: YouTube Data API（videos.list statistics）。ほぼリアルタイム
 * - 平均視聴率・シェア: YouTube Analytics API。反映まで1〜2日かかるため、取れない間は null
 */
export async function fetchYouTubeMetrics(videoId: string, publishedAt: Date): Promise<
  | { ok: true; metric: PlatformMetricRecord; retentionAvailable: boolean }
  | { ok: false; error: string }
> {
  const auth = YouTubePublisher.getAuthorizedClient();
  if (!auth) {
    return { ok: false, error: 'YouTube の認証情報（YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN）が未設定です' };
  }

  const youtube = google.youtube({ version: 'v3', auth });
  const videoRes = await youtube.videos.list({ part: ['statistics'], id: [videoId] });
  const stats = videoRes.data.items?.[0]?.statistics;
  if (!stats) {
    return { ok: false, error: `動画が見つかりません（videoId: ${videoId}）` };
  }

  const views = Number(stats.viewCount ?? 0);
  const likes = Number(stats.likeCount ?? 0);
  const comments = Number(stats.commentCount ?? 0);

  let shares = 0;
  let retentionRate: number | null = null;
  let retentionAvailable = false;
  try {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth });
    const report = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate: publishedAt.toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      metrics: 'averageViewPercentage,shares',
      filters: `video==${videoId}`,
    });
    const row = report.data.rows?.[0];
    if (row) {
      retentionRate = Math.round(Number(row[0]) * 10) / 10;
      shares = Number(row[1]);
      retentionAvailable = true;
    }
  } catch (error) {
    // Analytics API 側の未反映・権限不足は致命的ではない（再生数等は取れている）
    console.warn('YouTube Analytics API から視聴率を取得できませんでした:', error instanceof Error ? error.message : error);
  }

  return {
    ok: true,
    retentionAvailable,
    metric: {
      platform: 'youtube',
      views,
      likes,
      shares,
      comments,
      engagementRate: views > 0 ? Math.round(((likes + comments + shares) / views) * 1000) / 10 : 0,
      retentionRate,
    },
  };
}
