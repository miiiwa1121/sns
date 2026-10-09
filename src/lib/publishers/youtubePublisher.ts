import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// デスクトップアプリ型 OAuth クライアントのループバック受け口（scripts/agent/youtube-auth.ts が待ち受ける）
export const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

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
   * 認証済み OAuth2 クライアントを取得（クライアントID・シークレット・リフレッシュトークンが揃っていなければ null）。
   * リフレッシュトークンは scripts/agent/youtube-auth.ts で取得する。
   */
  static getAuthorizedClient() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, YOUTUBE_REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  /**
   * YouTubeへ動画をアップロード
   */
  static async uploadVideo(params: YouTubeUploadParams): Promise<YouTubeUploadResult> {
    const { videoFilePath, title, description, tags, privacyStatus = 'private' } = params;

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

    const oauth2Client = this.getAuthorizedClient();

    // 2. 認証情報が未設定の場合は投稿しない（偽のURLを返すと DB が「配信済み」になるため、成功扱いにしない）
    if (!oauth2Client) {
      return {
        success: false,
        isSimulated: true,
        message: 'YouTube API認証情報（YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN）が未設定のため、投稿していません。',
      };
    }

    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client,
      });

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
            privacyStatus, // 未審査の API プロジェクトからは private しか許されないため既定は private
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
