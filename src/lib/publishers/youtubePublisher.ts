import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

export interface YouTubeUploadParams {
  videoFilePath: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
}

export interface YouTubeUploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  isSimulated?: boolean;
  message: string;
}

export class YouTubePublisher {
  /**
   * OAuth2クライアントを取得
   */
  private static getOAuth2Client() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/auth/youtube/callback';
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    if (refreshToken) {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
    }

    return oauth2Client;
  }

  /**
   * YouTubeへ動画をアップロード
   */
  static async uploadVideo(params: YouTubeUploadParams): Promise<YouTubeUploadResult> {
    const { videoFilePath, title, description, tags, privacyStatus = 'unlisted' } = params;

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

    const oauth2Client = this.getOAuth2Client();

    // 2. 認証情報が未設定の場合はシミュレーションモードで安全に応答
    if (!oauth2Client || !process.env.YOUTUBE_REFRESH_TOKEN) {
      const simulatedVideoId = `yt_${Date.now()}`;
      return {
        success: true,
        videoId: simulatedVideoId,
        videoUrl: `https://youtube.com/shorts/${simulatedVideoId}`,
        isSimulated: true,
        message: 'YouTube API認証情報（YOUTUBE_REFRESH_TOKEN）が未設定のため、シミュレーション投稿として処理しました。環境変数を設定すると実YouTubeチャンネルへ自動アップロードされます。',
      };
    }

    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client,
      });

      const fileSize = fs.statSync(fullPath).size;
      const media = {
        body: fs.createReadStream(fullPath),
      };

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: title.slice(0, 100), // YouTubeタイトル上限100文字
            description,
            tags,
            categoryId: '28', // Science & Technology
          },
          status: {
            privacyStatus, // 安全のためデフォルトは限定公開 (unlisted)
            selfDeclaredMadeForKids: false,
          },
        },
        media,
      });

      const videoId = response.data.id;
      if (!videoId) {
        throw new Error('動画IDが返却されませんでした');
      }

      return {
        success: true,
        videoId,
        videoUrl: `https://youtube.com/shorts/${videoId}`,
        isSimulated: false,
        message: `YouTubeへの実動画アップロードが完了しました！（動画ID: ${videoId}）`,
      };
    } catch (error: any) {
      console.error('YouTube API upload error:', error);
      return {
        success: false,
        message: `YouTube APIアップロードエラー: ${error.message || error}`,
      };
    }
  }
}
