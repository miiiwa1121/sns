import { YouTubePublisher, YouTubeUploadResult } from './youtubePublisher';
import { TikTokPublisher, TikTokUploadResult } from './tiktokPublisher';
import { InstagramPublisher, InstagramUploadResult } from './instagramPublisher';
import { XPublisher, XUploadResult } from './xPublisher';

export interface DispatchAllParams {
  videoFilePath: string;
  youtube: {
    title: string;
    description: string;
    tags: string[];
    privacyStatus?: 'public' | 'unlisted' | 'private';
  };
  tiktok: {
    caption: string;
    privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  };
  instagram: {
    caption: string;
    shareToFeed?: boolean;
  };
  x: {
    text: string;
  };
}

export interface DispatchAllResult {
  youtube: YouTubeUploadResult;
  tiktok: TikTokUploadResult;
  instagram: InstagramUploadResult;
  x: XUploadResult;
  allSuccess: boolean;
}

export class MultiPlatformPublisher {
  /**
   * 全プラットフォーム（YouTube, TikTok, Instagram, X）へ一括並列アップロードを実行
   */
  static async publishAll(params: DispatchAllParams): Promise<DispatchAllResult> {
    const { videoFilePath, youtube, tiktok, instagram, x } = params;

    const [ytResult, ttResult, igResult, xResult] = await Promise.all([
      YouTubePublisher.uploadVideo({
        videoFilePath,
        title: youtube.title,
        description: youtube.description,
        tags: youtube.tags,
        privacyStatus: youtube.privacyStatus,
      }),
      TikTokPublisher.uploadVideo({
        videoFilePath,
        caption: tiktok.caption,
        privacyLevel: tiktok.privacyLevel,
      }),
      InstagramPublisher.uploadVideo({
        videoFilePath,
        caption: instagram.caption,
        shareToFeed: instagram.shareToFeed,
      }),
      XPublisher.uploadVideo({
        videoFilePath,
        text: x.text,
      }),
    ]);

    const allSuccess = ytResult.success && ttResult.success && igResult.success && xResult.success;

    return {
      youtube: ytResult,
      tiktok: ttResult,
      instagram: igResult,
      x: xResult,
      allSuccess,
    };
  }
}

export { YouTubePublisher, TikTokPublisher, InstagramPublisher, XPublisher };
