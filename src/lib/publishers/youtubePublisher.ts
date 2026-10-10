import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { DATA_DIR } from '@/lib/storage';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

// アカウントごとのリフレッシュトークンを入れる環境変数名（.env.local）。例: tuiteikunogaseiippai → YOUTUBE_REFRESH_TOKEN__TUITEIKUNOGASEIIPPAI
export function youtubeTokenEnvName(accountSlug: string): string {
  return `YOUTUBE_REFRESH_TOKEN__${accountSlug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

export interface YouTubeUploadParams {
  accountSlug: string;
  expectedChannelId: string | null; // アカウントに登録したチャンネル。認証先と違えば投稿しない
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
   * アカウントの認証済み OAuth2 クライアントを取得（クライアントID・シークレット・そのアカウントのリフレッシュトークンが揃っていなければ null）。
   * リフレッシュトークンは管理画面のアカウント画面の「YouTube と連携する」で取得する（src/lib/youtubeAuth.ts）。アカウントごとに別の YouTube チャンネルに対応する
   */
  static getAuthorizedClient(accountSlug: string) {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env[youtubeTokenEnvName(accountSlug)];

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    // リフレッシュトークンでの更新だけに使うため、戻り先（redirect URI）は要らない
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  /**
   * YouTubeへ動画をアップロード
   */
  static async uploadVideo(params: YouTubeUploadParams): Promise<YouTubeUploadResult> {
    const { accountSlug, expectedChannelId, videoFilePath, title, description, tags, privacyStatus = 'private' } = params;

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

    const oauth2Client = this.getAuthorizedClient(accountSlug);

    // 2. 認証情報が未設定の場合は投稿しない（偽のURLを返すと DB が「配信済み」になるため、成功扱いにしない）
    if (!oauth2Client) {
      return {
        success: false,
        isSimulated: true,
        message: `このアカウントの YouTube 連携が未設定のため、投稿していません。アカウント画面で「YouTube と連携する」を行ってください。`,
      };
    }

    try {
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client,
      });

      // 3. 認証先のチャンネルがアカウントに登録したチャンネルと同じか確認する（別チャンネルへの誤投稿を防ぐ）
      const mine = await youtube.channels.list({ part: ['id'], mine: true });
      const actualChannelId = mine.data.items?.[0]?.id ?? null;
      if (!expectedChannelId || actualChannelId !== expectedChannelId) {
        return {
          success: false,
          message: `認証先のチャンネル（${actualChannelId ?? '不明'}）がアカウントのチャンネル（${expectedChannelId ?? '未登録'}）と一致しないため、投稿していません。アカウント画面で「YouTube と連携する」をやり直してください。`,
        };
      }

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
