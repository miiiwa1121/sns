// 動画編集画面の「動画を作り直す」。保存済みの台本で、音声合成 → レンダリングを行う（中身は CLI の produce）。
// src/lib/services/editService.ts が別プロセスとして起動する: `tsx agent/render-runner.ts <projectId>`
// 進み具合は data/projects/<id>/work/produce.log に書き、画面が最後の1行を表示する
import './env';
import fs from 'fs';
import { spawn } from 'child_process';
import { prisma } from '../src/lib/prisma';
import { produceLogPath } from '../src/lib/services/editService';

async function main() {
  const projectId = process.argv[2] ?? '';
  const log = fs.createWriteStream(produceLogPath(projectId), { flags: 'a' });
  // 同じプロセスグループのまま起動する（停止のときに、ここと一緒に止まる）
  const child = spawn('npx', ['tsx', 'agent/cli.ts', 'produce', projectId], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));
  log.end();

  const clip = await prisma.shortClip.findFirst({ where: { projectId } });
  // 止められていたら（状態が rendering でなければ）何もしない
  if (!clip || clip.renderStatus !== 'rendering') return;
  if (code === 0) {
    await prisma.shortClip.update({ where: { id: clip.id }, data: { renderStatus: 'idle', renderPid: null, renderError: null } });
  } else {
    const tail = fs.readFileSync(produceLogPath(projectId), 'utf-8').trim().split('\n').slice(-3).join(' / ');
    await prisma.shortClip.update({
      where: { id: clip.id },
      data: { renderStatus: 'failed', renderPid: null, renderError: `作り直しに失敗しました（動画は前のままです）: ${tail.slice(-400)}` },
    });
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    const clip = await prisma.shortClip.findFirst({ where: { projectId: process.argv[2] ?? '' } }).catch(() => null);
    if (clip?.renderStatus === 'rendering') {
      await prisma.shortClip.update({ where: { id: clip.id }, data: { renderStatus: 'failed', renderPid: null, renderError: String(error) } }).catch(() => {});
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
