import fs from 'fs';
import path from 'path';

export interface TikTokUploadParams {
  videoFilePath: string;
  caption: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableDuet?: boolean;
  disableStitch?: boolean;
  disableComment?: boolean;
}

export interface TikTokUploadResult {
  success: boolean;
  publishId?: string;
  videoUrl?: string;
  isSimulated?: boolean;
  message: string;
}

export class TikTokPublisher {
  /**
   * TikTok Content Posting API (Direct Post) 経由で動画を投稿
   */
  static async uploadVideo(params: TikTokUploadParams): Promise<TikTokUploadResult> {
    const {
      videoFilePath,
      caption,
      privacyLevel = 'PUBLIC_TO_EVERYONE',
      disableDuet = false,
      disableStitch = false,
      disableComment = false,
    } = params;

    // 1. 実動画ファイルの存在確認
    const fullPath = path.isAbsolute(videoFilePath)
      ? videoFilePath
      : path.join(process.cwd(), 'public/videos', path.basename(videoFilePath));

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        message: `動画ファイルが存在しません: ${fullPath}`,
      };
    }

    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;

    // 2. 認証情報が未設定の場合は投稿しない（成功扱いにしない）
    if (!accessToken) {
      return {
        success: false,
        isSimulated: true,
        message: 'TikTok APIアクセストークン（TIKTOK_ACCESS_TOKEN）が未設定のため、投稿していません。',
      };
    }

    try {
      const fileSize = fs.statSync(fullPath).size;

      // 3. 動画投稿の初期化リクエスト (POST /v2/post/publish/video/init/)
      const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: caption.slice(0, 2200), // TikTokキャプション上限
            privacy_level: privacyLevel,
            disable_duet: disableDuet,
            disable_stitch: disableStitch,
            disable_comment: disableComment,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: fileSize,
            chunk_size: fileSize,
            total_chunk_count: 1,
          },
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || initData.error?.code !== 'ok') {
        throw new Error(initData.error?.message || 'TikTok初期化リクエストに失敗しました');
      }

      const uploadUrl = initData.data?.upload_url;
      const publishId = initData.data?.publish_id;

      // 4. 動画バイナリのアップロード (PUT upload_url)
      const fileBuffer = fs.readFileSync(fullPath);
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
        },
        body: fileBuffer,
      });

      if (!uploadRes.ok) {
        throw new Error(`TikTokバイナリアップロードに失敗しました (ステータス: ${uploadRes.status})`);
      }

      // publish_id は動画IDではないため URL は組み立てない（公開後に status/fetch で動画IDを取得する）
      return {
        success: true,
        publishId,
        isSimulated: false,
        message: `TikTokへの実動画アップロードが完了しました！（Publish ID: ${publishId}）`,
      };
    } catch (error: any) {
      console.error('TikTok API upload error:', error);
      return {
        success: false,
        message: `TikTok APIアップロードエラー: ${error.message || error}`,
      };
    }
  }
}
