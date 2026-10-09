import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { MultiPlatformPublisher, DispatchAllParams } from '@/lib/publishers';
import { safeJson } from '@/lib/projectMapper';
import { PlatformType } from '@/lib/types';

export const PLATFORMS: PlatformType[] = ['youtube', 'tiktok', 'instagram', 'x'];
export const VIDEO_DIR = path.resolve(process.cwd(), 'public/videos');

export interface PublishOptions {
  // 投稿先。省略時は4媒体すべて
  platforms?: PlatformType[];
  // 未審査の YouTube API プロジェクトからのアップロードは非公開に制限されるため、既定は private
  youtubePrivacy?: 'public' | 'unlisted' | 'private';
}

export type PublishOutcome =
  | { ok: false; httpStatus: number; error: string }
  | {
      ok: true;
      allPublished: boolean;
      succeeded: PlatformType[];
      failed: { platform: PlatformType; message: string }[];
    };

/**
 * プロジェクトの承認済みレンダリング済みショートを配信し、結果をプラットフォームごとに記録する。
 * ダッシュボード（/api/publish）とエージェント CLI の両方から使う。
 */
export async function publishProject(projectId: string, options: PublishOptions = {}): Promise<PublishOutcome> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { shortClips: true, publishLogs: true },
  });
  if (!project) {
    return { ok: false, httpStatus: 404, error: '指定されたプロジェクトが見つかりません' };
  }

  // 1. 配信対象: 承認済み（readyToPublish）かつレンダリング済みのショート
  const clip = project.shortClips.find((c) => c.readyToPublish && c.renderedFilePath);
  if (!clip?.renderedFilePath) {
    return { ok: false, httpStatus: 400, error: '承認済み（readyToPublish）かつレンダリング済み（renderedFilePath）のショートがありません' };
  }
  // basename に限定して public/videos/ の外を指せないようにする
  const videoFilePath = path.join(VIDEO_DIR, path.basename(clip.renderedFilePath));
  if (!fs.existsSync(videoFilePath)) {
    return { ok: false, httpStatus: 400, error: `動画ファイルが存在しません: public/videos/${path.basename(clip.renderedFilePath)}` };
  }

  // 2. 配信済みのプラットフォームには再送しない（二重投稿防止）
  const logByPlatform = new Map(project.publishLogs.map((l) => [l.platform, l]));
  const requested = options.platforms ?? PLATFORMS;
  const targets = requested.filter((p) => logByPlatform.get(p)?.status !== 'published');
  if (targets.length === 0) {
    return { ok: false, httpStatus: 409, error: '指定されたプラットフォームはすべて配信済みです' };
  }

  const ytLog = logByPlatform.get('youtube');
  const ttLog = logByPlatform.get('tiktok');
  const igLog = logByPlatform.get('instagram');
  const xLog = logByPlatform.get('x');

  const params: DispatchAllParams = { videoFilePath };
  if (targets.includes('youtube')) {
    params.youtube = {
      title: ytLog?.title || project.title,
      description: ytLog?.caption || project.concept,
      tags: safeJson<string[]>(ytLog?.tagsJson, []),
      privacyStatus: options.youtubePrivacy ?? 'private',
    };
  }
  if (targets.includes('tiktok')) {
    params.tiktok = { caption: ttLog?.caption || project.title, privacyLevel: 'PUBLIC_TO_EVERYONE' };
  }
  if (targets.includes('instagram')) {
    params.instagram = { caption: igLog?.caption || project.concept, shareToFeed: true };
  }
  if (targets.includes('x')) {
    params.x = { text: xLog?.caption || project.title };
  }

  // 3. 並列配信
  const result = await MultiPlatformPublisher.publishAll(params);

  // 4. 結果をプラットフォームごとに記録（実投稿に成功したものだけ published）
  const now = new Date();
  const outcomes = targets.map((platform) => {
    const r = result[platform];
    const ok = Boolean(r?.success && !r.isSimulated);
    const postUrl = r && 'tweetUrl' in r ? r.tweetUrl : r && 'videoUrl' in r ? r.videoUrl : undefined;
    const externalId = r && 'videoId' in r ? r.videoId
      : r && 'publishId' in r ? r.publishId
      : r && 'mediaId' in r ? r.mediaId
      : r && 'tweetId' in r ? r.tweetId
      : undefined;
    return { platform, ok, postUrl, externalId, message: r?.message ?? '結果が返りませんでした' };
  });

  const publishedAfter = new Set(PLATFORMS.filter((p) => logByPlatform.get(p)?.status === 'published'));
  outcomes.filter((o) => o.ok).forEach((o) => publishedAfter.add(o.platform));
  const allPublished = publishedAfter.size === PLATFORMS.length;

  await prisma.$transaction([
    ...outcomes.map((o) => {
      const data = o.ok
        ? { status: 'published', publishedAt: now, postUrl: o.postUrl ?? null, externalId: o.externalId ?? null, errorMessage: null, shortClipId: clip.id }
        : { status: 'failed', errorMessage: o.message, shortClipId: clip.id };
      const existing = logByPlatform.get(o.platform);
      return existing
        ? prisma.publishLog.update({ where: { id: existing.id }, data })
        : prisma.publishLog.create({ data: { ...data, projectId: project.id, platform: o.platform } });
    }),
    // 1媒体でも出たら published、全媒体そろうまでは他媒体を追加配信できる
    ...(publishedAfter.size > 0
      ? [prisma.project.update({ where: { id: project.id }, data: { stage: 'published' } })]
      : []),
  ]);

  return {
    ok: true,
    allPublished,
    succeeded: outcomes.filter((o) => o.ok).map((o) => o.platform),
    failed: outcomes.filter((o) => !o.ok).map(({ platform, message }) => ({ platform, message })),
  };
}

/**
 * API を使わず人が投稿した結果を記録する（TikTok / Instagram / X の手動投稿用）
 */
export async function recordManualPublish(projectId: string, platform: PlatformType, postUrl: string) {
  const existing = await prisma.publishLog.findFirst({ where: { projectId, platform } });
  // YouTube は URL から動画IDを取り出しておくと、手動投稿でも metrics:collect で実測値を自動取得できる
  const externalId = platform === 'youtube' ? extractYouTubeVideoId(postUrl) : null;
  const data = { status: 'published', publishedAt: new Date(), postUrl, externalId, errorMessage: null };
  await prisma.$transaction([
    existing
      ? prisma.publishLog.update({ where: { id: existing.id }, data })
      : prisma.publishLog.create({ data: { ...data, projectId, platform } }),
    prisma.project.update({ where: { id: projectId }, data: { stage: 'published' } }),
  ]);
}

/**
 * YouTube の URL（/shorts/ID, /watch?v=ID, youtu.be/ID）から動画IDを取り出す。取れなければ null
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    const id = host === 'youtu.be'
      ? u.pathname.slice(1)
      : host === 'youtube.com'
        ? (u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1] ?? u.searchParams.get('v'))
        : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
