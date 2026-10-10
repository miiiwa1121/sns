import fs from 'fs';
import path from 'path';
import { DATA_DIR, mediaUrlPath } from '@/lib/storage';

export interface InstagramUploadParams {
  videoFilePath: string;
  caption: string;
  shareToFeed?: boolean;
}

export interface InstagramUploadResult {
  success: boolean;
  mediaId?: string;
  videoUrl?: string;
  isSimulated?: boolean;
  message: string;
}

export class InstagramPublisher {
  /**
   * Instagram Graph API 経由でリール動画を投稿
   */
  static async uploadVideo(params: InstagramUploadParams): Promise<InstagramUploadResult> {
    const {
      videoFilePath,
      caption,
      shareToFeed = true,
    } = params;

    // 1. 実動画ファイルの存在確認
    const fullPath = path.isAbsolute(videoFilePath)
      ? videoFilePath
      : path.join(DATA_DIR, videoFilePath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        message: `動画ファイルが存在しません: ${fullPath}`,
      };
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    // 2. 認証情報が未設定の場合は投稿しない（成功扱いにしない）
    if (!accessToken || !igAccountId) {
      return {
        success: false,
        isSimulated: true,
        message: 'Instagram Graph API認証情報（INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID）が未設定のため、投稿していません。',
      };
    }

    try {
      const apiBase = 'https://graph.facebook.com/v19.0';

      // 3. メディアコンテナの作成 (POST /{ig-user-id}/media)
      // 注意: 本番環境では外部からアクセス可能な動画URLまたはResumable Uploadを利用
      const hostUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      const publicVideoUrl = `${hostUrl}${mediaUrlPath(path.relative(DATA_DIR, fullPath))}`;

      const containerRes = await fetch(`${apiBase}/${igAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          video_url: publicVideoUrl,
          caption: caption.slice(0, 2200),
          share_to_feed: shareToFeed,
          access_token: accessToken,
        }),
      });

      const containerData = await containerRes.json();
      if (!containerRes.ok || containerData.error) {
        throw new Error(containerData.error?.message || 'Instagramコンテナ作成に失敗しました');
      }

      const creationId = containerData.id;

      // 4. メディアの公開 (POST /{ig-user-id}/media_publish)
      const publishRes = await fetch(`${apiBase}/${igAccountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
      });

      const publishData = await publishRes.json();
      if (!publishRes.ok || publishData.error) {
        throw new Error(publishData.error?.message || 'Instagramメディア公開に失敗しました');
      }

      const mediaId = publishData.id;

      return {
        success: true,
        mediaId,
        videoUrl: `https://www.instagram.com/reel/${mediaId}`,
        isSimulated: false,
        message: `Instagram Reels への実動画アップロードが完了しました！（Media ID: ${mediaId}）`,
      };
    } catch (error: any) {
      console.error('Instagram API upload error:', error);
      return {
        success: false,
        message: `Instagram APIアップロードエラー: ${error.message || error}`,
      };
    }
  }
}
