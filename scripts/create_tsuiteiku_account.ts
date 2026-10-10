import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_HANDLE = '@tuiteikunogaseiippai';

async function main() {
  const existing = await prisma.account.count();
  if (existing > 0) {
    console.log(`⚠️ 既にアカウントが ${existing} 件あるため登録を中止します（データは変更していません）。`);
    return;
  }

  const account = await prisma.account.create({
    data: {
      name: 'ついていくのが精一杯',
      slug: 'tuiteikunogaseiippai',
      category: 'AI・IT',
      concept: '目まぐるしく進化する最新テックやAIトレンドについていくのが精一杯な人のための、手軽に追えるキャッチアップ動画媒体',
      targetAudience: '最新のAI・ITトレンドを追いたいが、情報量が多くて追いきれない人',
      platformConnections: {
        create: [
          { platform: 'youtube', handle: BASE_HANDLE, isConnected: true },
          { platform: 'tiktok', handle: BASE_HANDLE, isConnected: true },
          { platform: 'instagram', handle: BASE_HANDLE, isConnected: true },
          // X は15文字制限のため未確定。確定後に更新する
          { platform: 'x', handle: '', isConnected: false },
        ],
      },
    },
  });

  console.log(`✨ 登録完了: ${account.name} (ID: ${account.id}, slug: ${account.slug})`);
}

main()
  .catch((e) => {
    console.error('Error creating account:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
