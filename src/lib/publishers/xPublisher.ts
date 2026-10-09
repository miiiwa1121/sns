import fs from 'fs';
import path from 'path';

export interface XUploadParams {
  videoFilePath: string;
  text: string;
}

export interface XUploadResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  isSimulated?: boolean;
  message: string;
}

export class XPublisher {
  /**
   * X (Twitter) API 経由で動画付きポストを投稿
   *
   * 未実装。OAuth 1.0a 署名付きの chunked media upload（INIT / APPEND / FINALIZE / STATUS）と
   * POST /2/tweets が必要。実装されるまでは、成功したように見せず必ず失敗を返す。
   */
  static async uploadVideo(params: XUploadParams): Promise<XUploadResult> {
    const { videoFilePath } = params;

    const fullPath = path.isAbsolute(videoFilePath)
      ? videoFilePath
      : path.join(process.cwd(), 'public/videos', path.basename(videoFilePath));

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        message: `動画ファイルが存在しません: ${fullPath}`,
      };
    }

    const hasCredentials = Boolean(
      process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_TOKEN_SECRET
    );

    return {
      success: false,
      isSimulated: !hasCredentials,
      message: hasCredentials
        ? 'X への動画投稿は未実装のため、投稿していません。'
        : 'X APIキー/トークンが未設定、かつ X への動画投稿は未実装のため、投稿していません。',
    };
  }
}
