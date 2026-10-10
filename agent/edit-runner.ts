// 動画編集画面で、AI の発言（pending）を埋める。src/lib/services/editService.ts が別プロセスとして起動する:
//   `tsx agent/edit-runner.ts <messageId>`
import './env';
import { prisma } from '../src/lib/prisma';
import { runEditMessage } from '../src/lib/services/editService';

runEditMessage(process.argv[2] ?? '')
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
