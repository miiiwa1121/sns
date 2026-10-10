// 生成物（動画・音声・作業ファイル・ジョブのログ）の保管場所に関する定義。data/ 配下は git 管理外。
// DB の ShortClip.renderedFilePath には、data/ からの相対パス（例: projects/<id>/video.mp4）を保存する。
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.resolve(process.cwd(), 'data');

// ---- プロジェクトごとの保管場所 ----
// data/projects/<id>/video.mp4   完成動画（配信対象）
// data/projects/<id>/thumb.jpg   サムネイル
// data/projects/<id>/work/       作業ファイル（props.json・確認用静止画・手動投稿パッケージ・レンダリング用の一時素材）

export function projectDir(projectId: string): string {
  return path.join(DATA_DIR, 'projects', projectId);
}

export function projectWorkDir(projectId: string): string {
  return path.join(projectDir(projectId), 'work');
}

/** DB に保存する動画の相対パス */
export function videoRelPath(projectId: string): string {
  return `projects/${projectId}/video.mp4`;
}

/** 動画の相対パスからサムネイルの相対パスを求める */
export function thumbRelPath(videoRel: string): string {
  return videoRel.replace(/video\.mp4$/, 'thumb.jpg');
}

// ---- 依頼ジョブの作業フォルダ ----
// data/jobs/<jobId>/   指示書・台本 JSON・ログ（log.jsonl）

export function jobDir(jobId: string): string {
  return path.join(DATA_DIR, 'jobs', jobId);
}

// ---- 配信（管理画面・Instagram への URL 渡し） ----

const MEDIA_PATH = /^projects\/[A-Za-z0-9_-]+\/(video\.mp4|thumb\.jpg)$/;

/** 配信を許す相対パスか（動画とサムネイルのみ） */
export function isServableMedia(rel: string): boolean {
  return MEDIA_PATH.test(rel);
}

/** 相対パスを絶対パスにする。data/ の外を指す、または配信対象でないパスは null */
export function resolveMediaPath(rel: string): string | null {
  if (!isServableMedia(rel)) return null;
  const full = path.resolve(DATA_DIR, rel);
  return full.startsWith(DATA_DIR + path.sep) ? full : null;
}

/** 配信対象のファイルが data/ に実在するか（clean で消した後など） */
export function mediaExists(rel: string): boolean {
  const full = resolveMediaPath(rel);
  return full !== null && fs.existsSync(full);
}

/** 管理画面・外部サービスから動画を取るための URL パス（/api/media/[...path] が返す） */
export function mediaUrlPath(rel: string): string {
  return `/api/media/${rel}`;
}
