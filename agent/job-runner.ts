// 管理画面からの依頼（AgentJob）を実行する。src/app/actions.ts が別プロセスとして起動する: `tsx agent/job-runner.ts <jobId>`
//   claude-code: `claude -p` を画面なしで最後まで実行し、出力（stream-json）を log.jsonl に書く
//   antigravity: Antigravity IDE のチャットに指示書を送る（実行は IDE 上。完了は企画の状態で判定する）
import './env';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '../src/lib/prisma';
import { jobDir, DATA_DIR } from '../src/lib/storage';
import { runAutoCleanup } from '../src/lib/services/cleanupService';
import { loadAiSettings } from '../src/lib/ai/providers';
import { DEFAULT_TEMPLATE } from '../src/lib/services/templateService';
import { buildJobPrompt } from './job-prompt';


// 依頼で動くエージェントに許すコマンド（承認・投稿・数字の記録は含めない）
const ALLOWED_AGENT_COMMANDS = ['status', 'knowledge', 'trend:add', 'project:create', 'project:update', 'produce', 'storyboard'];

export function jobWorkDir(jobId: string): string {
  return jobDir(jobId);
}

async function finish(jobId: string, status: 'succeeded' | 'failed', error?: string) {
  await prisma.agentJob.update({ where: { id: jobId }, data: { status, error: error ?? null, finishedAt: new Date(), pid: null } });
  // 設定で自動整理が有効なら、古い生成物を整理する（失敗しても依頼の結果には影響させない）
  await runAutoCleanup().catch((e) => console.error('自動整理に失敗しました', e));
}

async function main() {
  const jobId = process.argv[2];
  const job = await prisma.agentJob.findUnique({ where: { id: jobId }, include: { account: true } });
  if (!job) throw new Error(`依頼 ${jobId} が見つかりません`);

  const repoDir = process.cwd();
  const workDir = jobWorkDir(job.id);
  fs.mkdirSync(workDir, { recursive: true });
  // 依頼した時点の構成案（写し）を使う。写しのない古い依頼は既定の構成案
  const template = job.templateBody ? { name: job.templateName ?? '（名前なし）', body: job.templateBody } : DEFAULT_TEMPLATE;
  const prompt = buildJobPrompt({ jobId: job.id, repoDir, workDir, theme: job.theme, channel: job.account, template });
  fs.writeFileSync(path.join(workDir, 'prompt.md'), prompt);
  // 台本 JSON の実例（第1弾）。指示書から参照する
  fs.copyFileSync(path.join(repoDir, 'agent/examples/project.example.json'), path.join(workDir, 'example-project.json'));
  // 場面の型定義（作業フォルダの外のソースは読めないため、参照用にコピーする）
  fs.copyFileSync(path.join(repoDir, 'remotion/types.ts'), path.join(workDir, 'scene-types.ts'));

  // AI の場所とモデルは、管理画面の「AI 連携」の設定に従う
  const ai = await loadAiSettings();
  const ANTIGRAVITY_BIN = ai.antigravityBin;
  const CLAUDE_BIN = ai.claudeBin;
  if (job.provider === 'antigravity') {
    if (!ANTIGRAVITY_BIN) return finish(job.id, 'failed', 'Antigravity が登録されていません（AI 連携の「API 以外」で追加してください）');
    if (!fs.existsSync(ANTIGRAVITY_BIN)) return finish(job.id, 'failed', `Antigravity が見つかりません: ${ANTIGRAVITY_BIN}`);
    // IDE のチャットに送るだけで、ここではすぐ終わる。進み具合は IDE で見て、完了は企画ができたかで判定する
    const child = spawn(ANTIGRAVITY_BIN, ['chat', '-m', 'agent', '-r', prompt], { cwd: repoDir, stdio: 'ignore', detached: true });
    child.unref();
    return;
  }

  if (!CLAUDE_BIN) return finish(job.id, 'failed', 'Claude Code が登録されていません（AI 連携の「API 以外」で追加してください）');
  if (!fs.existsSync(CLAUDE_BIN)) return finish(job.id, 'failed', `Claude Code が見つかりません: ${CLAUDE_BIN}`);
  const agentCmd = `npm --prefix ${repoDir} run -s agent --`;
  const dataDir = DATA_DIR;
  // 読み書きは作業フォルダ（cwd）と data/ に限定する（"//" 始まりは絶対パス）。
  // 単に 'Write' / 'Read' と許可すると場所を問わず許可され、.env.local（認証情報）も読めてしまう（2026-10-10 に確認）
  const allowedTools = [
    'WebSearch',
    'WebFetch',
    'Read(./**)',
    'Edit(./**)',
    `Read(/${dataDir}/**)`,
    `Edit(/${dataDir}/**)`,
    ...ALLOWED_AGENT_COMMANDS.map((c) => `Bash(${agentCmd} ${c}:*)`),
  ];
  const log = fs.createWriteStream(path.join(workDir, 'log.jsonl'), { flags: 'a' });
  const child = spawn(
    CLAUDE_BIN,
    [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      // 許可リスト外の操作は聞かずに拒否する。書き込みは作業フォルダ（cwd）と --add-dir の範囲に限られる
      '--permission-mode', 'dontAsk',
      '--allowedTools', ...allowedTools,
      '--add-dir', dataDir,
      '--no-session-persistence',
      // 「AI 連携」で依頼に割り当てたモデル（空なら Claude Code の既定）
      ...(ai.job.provider === 'claude-code' && ai.job.model ? ['--model', ai.job.model] : []),
    ],
    // AGENT_JOB_ID があると、CLI 側でも承認・投稿などを拒否する
    { cwd: workDir, env: { ...process.env, AGENT_JOB_ID: job.id }, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  await prisma.agentJob.update({ where: { id: job.id }, data: { pid: child.pid ?? null } });
  child.stdout.pipe(log);
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d.toString()));

  const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));
  log.end();

  const latest = await prisma.agentJob.findUnique({
    where: { id: job.id },
    include: { project: { include: { shortClips: true } } },
  });
  if (latest?.status === 'canceled') return;
  const rendered = Boolean(latest?.project?.shortClips[0]?.renderedFilePath);
  if (code === 0 && rendered) return finish(job.id, 'succeeded');
  return finish(job.id, 'failed', code !== 0 ? `終了コード ${code}${stderr ? `: ${stderr.slice(-500)}` : ''}` : '動画が作られないまま終了しました');
}

main()
  .catch(async (error) => {
    console.error(error);
    const jobId = process.argv[2];
    if (jobId) await finish(jobId, 'failed', error instanceof Error ? error.message : String(error)).catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
