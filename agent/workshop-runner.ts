// 構成案の相談で、AI の発言（pending）を埋める。src/lib/services/workshopService.ts が別プロセスとして起動する:
//   `tsx agent/workshop-runner.ts <messageId>`
import './env';
import { prisma } from '../src/lib/prisma';
import { runWorkshopMessage } from '../src/lib/services/workshopService';

runWorkshopMessage(process.argv[2] ?? '')
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
