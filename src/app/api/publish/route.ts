import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MultiPlatformPublisher } from '@/lib/publishers';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId は必須です' },
        { status: 400 }
      );
    }

    // 1. SQLite DB から対象プロジェクトを取得
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        shortClips: true,
        publishLogs: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: '指定されたプロジェクトが見つかりません' },
        { status: 404 }
      );
    }

    // アップロード対象の実動画ファイルパス
    const videoFilePath = path.resolve(process.cwd(), 'public/videos/short_clip_1.mp4');

    // 各プラットフォーム用メタデータの取得
    const ytLog = project.publishLogs.find(l => l.platform === 'youtube');
    const ttLog = project.publishLogs.find(l => l.platform === 'tiktok');
    const igLog = project.publishLogs.find(l => l.platform === 'instagram');
    const xLog = project.publishLogs.find(l => l.platform === 'x');

    const ytTags = ytLog?.tagsJson ? JSON.parse(ytLog.tagsJson) : ['AIエージェント', '最新トレンド'];

    // 2. 全SNS並列自動配信パイプラインの実行
    const dispatchResult = await MultiPlatformPublisher.publishAll({
      videoFilePath,
      youtube: {
        title: ytLog?.title || project.title,
        description: ytLog?.caption || project.concept,
        tags: ytTags,
        privacyStatus: 'unlisted',
      },
      tiktok: {
        caption: ttLog?.caption || project.title,
        privacyLevel: 'PUBLIC_TO_EVERYONE',
      },
      instagram: {
        caption: igLog?.caption || project.concept,
        shareToFeed: true,
      },
      x: {
        text: xLog?.caption || project.title,
      },
    });

    // 3. SQLite DB の配信ログを更新
    const now = new Date();
    const platformUrlMap: Record<string, string | undefined> = {
      youtube: dispatchResult.youtube.videoUrl,
      tiktok: dispatchResult.tiktok.videoUrl,
      instagram: dispatchResult.instagram.videoUrl,
      x: dispatchResult.x.tweetUrl,
    };

    for (const log of project.publishLogs) {
      await prisma.publishLog.update({
        where: { id: log.id },
        data: {
          status: 'published',
          publishedAt: now,
          postUrl: platformUrlMap[log.platform] || log.postUrl,
        },
      });
    }

    // プロジェクトのステージも 'published' に更新
    await prisma.project.update({
      where: { id: project.id },
      data: {
        stage: 'published',
      },
    });

    return NextResponse.json({
      success: true,
      message: '全プラットフォーム（YouTube, TikTok, Instagram, X）への自動配信処理が完了しました！',
      results: dispatchResult,
      publishedUrl: dispatchResult.youtube.videoUrl || dispatchResult.x.tweetUrl || '',
    });
  } catch (error: any) {
    console.error('Publish API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '配信処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
