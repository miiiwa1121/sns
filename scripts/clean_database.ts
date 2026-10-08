import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 架空のデモデータ（架空チャンネル・架空プロジェクト・架空再生数）を完全消去します...');

  await prisma.analyticsMetric.deleteMany();
  await prisma.publishLog.deleteMany();
  await prisma.shortClip.deleteMany();
  await prisma.longFormVideo.deleteMany();
  await prisma.project.deleteMany();
  await prisma.trendResearch.deleteMany();
  await prisma.agentKnowledge.deleteMany();
  await prisma.platformConnection.deleteMany();
  await prisma.account.deleteMany();

  console.log('✨ データベース（prisma/dev.db）の全消去が完了しました。0件の完全クリーン状態です。');
}

main()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
