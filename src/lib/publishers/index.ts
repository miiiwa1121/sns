import { YouTubePublisher, YouTubeUploadResult } from './youtubePublisher';
import { TikTokPublisher, TikTokUploadResult } from './tiktokPublisher';
import { InstagramPublisher, InstagramUploadResult } from './instagramPublisher';
import { XPublisher, XUploadResult } from './xPublisher';

// 各プラットフォームは省略可能。省略したプラットフォームには投稿しない（配信済みの再送防止に使う）
export interface DispatchAllParams {
  videoFilePath: string;
  youtube?: {
    accountSlug: string;
    expectedChannelId: string | null;
    title: string;
    description: string;
    tags: string[];
    privacyStatus?: 'public' | 'unlisted' | 'private';
  };
  tiktok?: {
    caption: string;
    privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  };
  instagram?: {
    caption: string;
    shareToFeed?: boolean;
  };
  x?: {
    text: string;
  };
}

export interface DispatchAllResult {
  youtube?: YouTubeUploadResult;
  tiktok?: TikTokUploadResult;
  instagram?: InstagramUploadResult;
  x?: XUploadResult;
}

export class MultiPlatformPublisher {
  /**
   * 指定されたプラットフォームへ並列アップロードを実行
   */
  static async publishAll(params: DispatchAllParams): Promise<DispatchAllResult> {
    const { videoFilePath, youtube, tiktok, instagram, x } = params;

    const [ytResult, ttResult, igResult, xResult] = await Promise.all([
      youtube && YouTubePublisher.uploadVideo({ videoFilePath, ...youtube }),
      tiktok && TikTokPublisher.uploadVideo({ videoFilePath, ...tiktok }),
      instagram && InstagramPublisher.uploadVideo({ videoFilePath, ...instagram }),
      x && XPublisher.uploadVideo({ videoFilePath, ...x }),
    ]);

    return {
      youtube: ytResult,
      tiktok: ttResult,
      instagram: igResult,
      x: xResult,
    };
  }
}

export { YouTubePublisher, TikTokPublisher, InstagramPublisher, XPublisher };
