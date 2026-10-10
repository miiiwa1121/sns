import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 実在運用アカウント「TechPulse」をSQLiteデータベースに登録します...');

  // 既存のデータを完全にクリーンにして最初のアカウントとして作成
  await prisma.analyticsMetric.deleteMany();
  await prisma.publishLog.deleteMany();
  await prisma.shortClip.deleteMany();
  await prisma.longFormVideo.deleteMany();
  await prisma.project.deleteMany();
  await prisma.trendResearch.deleteMany();
  await prisma.agentKnowledge.deleteMany();
  await prisma.platformConnection.deleteMany();
  await prisma.account.deleteMany();

  const account = await prisma.account.create({
    data: {
      name: 'TechPulse',
      slug: 'techpulse',
      category: 'テクノロジー / テックニュース',
      concept: '国内外の最新テクノロジー、AIエージェント、ガジェット、Webトレンドを最短でキャッチアップできる速報チャンネル',
      targetAudience: '20〜40代 ITエンジニア、ビジネスパーソン、最新テクノロジーに関心が高いクリエイター',
      platformConnections: {
        create: [
          { platform: 'youtube', handle: '@TechPulse-jp', isConnected: true },
          { platform: 'x', handle: '@TechPulse_jp', isConnected: true },
          { platform: 'tiktok', handle: '@techpulse_jp', isConnected: true },
          { platform: 'instagram', handle: '@techpulse.jp', isConnected: true },
        ],
      },
    },
    include: {
      platformConnections: true,
      projects: true,
      trendResearches: true,
      agentKnowledges: true,
    },
  });

  console.log(`✨ 「TechPulse」の登録が完了しました！（ID: ${account.id}, Slug: ${account.slug}）`);
  console.log('📊 プロジェクト数: 0 件、総再生数: 0 回の完全な初期状態です。');
}

main()
  .catch((e) => {
    console.error('Error creating account:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
