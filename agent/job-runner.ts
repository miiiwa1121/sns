// 管理画面からの依頼（AgentJob）を実行する。src/app/actions.ts が別プロセスとして起動する: `tsx agent/job-runner.ts <jobId>`
// 工程ごとに AI を変えられる（AI 連携で選ぶ。依頼した時点の割り当てを aiStepsJson に写して使う）:
//   1. リサーチ: Claude Code が Web で調べ、trend:add で登録する（trend:add が依頼にリサーチを記録する）
//   2. 台本    : 選んだ AI が JSON を1回返し、ここで project:create する（形が正しくなければ1回だけ直させる）
//   3. 制作    : produce（音声合成とレンダリング）。AI は使わない。声・速さ・BGM は依頼した時点の設定（produceJson）
//   4. 点検    : Claude Code が確認用の静止画を見て、必要なら直して作り直し、報告して終わる
// 作業の記録は log.jsonl に書く（Claude Code の stream-json と、ここで書く { type: "step" } の行が混ざる）。
import './env';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '../src/lib/prisma';
import { jobDir, DATA_DIR } from '../src/lib/storage';
import { runAutoCleanup } from '../src/lib/services/cleanupService';
import { PROVIDER_LABEL, loadAiSettings, providerProblem, runProviderJson, type AiSettings } from '../src/lib/ai/providers';
import { projectSchema } from '../src/lib/ai/schemas';
import { DEFAULT_TEMPLATE } from '../src/lib/services/templateService';
import { DEFAULT_PROHIBITIONS, DEFAULT_RESEARCH_METHOD } from '../src/lib/services/researchMethodService';
import { parseAiSteps, type JobPhase } from '../src/lib/jobs';
import { safeJson } from '../src/lib/json';
import {
  CHARS_PER_SEC_AT_1X,
  SPEED_OPTIONS,
  bgmOptions,
  parseProduceRequest,
  produceLabel,
  resolveProduce,
  voiceOptions,
  type ProduceSettings,
} from '../src/lib/services/produceSettings';
import { buildCheckPrompt, buildResearchPrompt, buildScriptPrompt, SCRIPT_SYSTEM_PROMPT, type JobPromptInput, type ResearchResult } from './job-prompt';

const repoDir = process.cwd();

export function jobWorkDir(jobId: string): string {
  return jobDir(jobId);
}

async function finish(jobId: string, status: 'succeeded' | 'failed', error?: string) {
  await prisma.agentJob.update({ where: { id: jobId }, data: { status, error: error ?? null, finishedAt: new Date(), pid: null } });
  // 設定で自動整理が有効なら、古い生成物を整理する（失敗しても依頼の結果には影響させない）
  await runAutoCleanup().catch((e) => console.error('自動整理に失敗しました', e));
}

async function canceled(jobId: string): Promise<boolean> {
  return (await prisma.agentJob.findUnique({ where: { id: jobId } }))?.status === 'canceled';
}

// 画面に出す作業の記録（Claude Code 以外の工程の分）
function note(workDir: string, entry: { kind: 'text'; text: string } | { kind: 'tool'; name: string; detail: string }) {
  fs.appendFileSync(path.join(workDir, 'log.jsonl'), JSON.stringify({ type: 'step', ...entry }) + '\n');
}

// 子プロセスは別のプロセスグループで動かし、pid を記録する（中止のとき、グループごと止める）
async function track(jobId: string, pid: number | undefined) {
  await prisma.agentJob.update({ where: { id: jobId }, data: { pid: pid ?? null } });
}

/** Claude Code に道具（Web 検索・決まったコマンド・作業フォルダと data/ の読み書き）を持たせて作業させる */
async function runClaudeAgent(
  jobId: string,
  workDir: string,
  bin: string,
  model: string,
  prompt: string,
  commands: string[]
): Promise<{ code: number; result: string; stderr: string }> {
  const agent = `npm --prefix ${repoDir} run -s agent --`;
  // 読み書きは作業フォルダ（cwd）と data/ に限定する（"//" 始まりは絶対パス）。
  // 単に 'Write' / 'Read' と許可すると場所を問わず許可され、.env.local（認証情報）も読めてしまう（2026-10-10 に確認）
  const allowedTools = [
    'WebSearch',
    'WebFetch',
    'Read(./**)',
    'Edit(./**)',
    `Read(/${DATA_DIR}/**)`,
    `Edit(/${DATA_DIR}/**)`,
    ...commands.map((c) => `Bash(${agent} ${c}:*)`),
  ];
  const log = fs.createWriteStream(path.join(workDir, 'log.jsonl'), { flags: 'a' });
  const child = spawn(
    bin,
    [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      // 許可リスト外の操作は聞かずに拒否する。書き込みは作業フォルダ（cwd）と --add-dir の範囲に限られる
      '--permission-mode', 'dontAsk',
      '--allowedTools', ...allowedTools,
      '--add-dir', DATA_DIR,
      '--no-session-persistence',
      '--model', model,
    ],
    // AGENT_JOB_ID があると、CLI 側でも承認・投稿などを拒否し、アカウントを依頼のものに限る
    { cwd: workDir, env: { ...process.env, AGENT_JOB_ID: jobId }, stdio: ['ignore', 'pipe', 'pipe'], detached: true }
  );
  await track(jobId, child.pid);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString();
    log.write(d);
  });
  child.stderr.on('data', (d) => (stderr += d.toString()));
  const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));
  log.end();
  // 最後の報告（stream-json の result 行）
  let result = '';
  for (const line of stdout.split('\n')) {
    try {
      const msg = JSON.parse(line) as { type?: string; result?: string };
      if (msg.type === 'result' && msg.result) result = msg.result;
    } catch {
      // 途中で切れた行などは読み飛ばす
    }
  }
  return { code, result, stderr };
}

/** このサービスの CLI を、依頼として実行する（AGENT_JOB_ID 付き。承認・投稿などは CLI が断る） */
async function runCli(jobId: string, workDir: string, args: string[]): Promise<{ code: number; output: string }> {
  note(workDir, { kind: 'tool', name: 'Bash', detail: `agent ${args.map((a) => (a.startsWith('/') ? path.basename(a) : a)).join(' ')}` });
  const child = spawn('npx', ['tsx', 'agent/cli.ts', ...args], {
    cwd: repoDir,
    env: { ...process.env, AGENT_JOB_ID: jobId },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  await track(jobId, child.pid);
  let output = '';
  child.stdout.on('data', (d) => (output += d.toString()));
  child.stderr.on('data', (d) => (output += d.toString()));
  const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));
  return { code, output: output.trim() };
}

async function setPhase(jobId: string, phase: JobPhase) {
  await prisma.agentJob.update({ where: { id: jobId }, data: { phase } });
}

type ProjectAnswer = { title: string; concept: string; lines: unknown[]; publish: Record<string, unknown>; produce?: { voice?: string; speed?: string; bgm?: string } };

async function main() {
  const jobId = process.argv[2];
  const job = await prisma.agentJob.findUnique({ where: { id: jobId }, include: { account: true } });
  if (!job) throw new Error(`依頼 ${jobId} が見つかりません`);
  const steps = parseAiSteps(job.aiStepsJson);
  if (!steps) return finish(job.id, 'failed', '工程ごとの AI が記録されていない依頼です（2026-10-11 より前の形式）。もう一度依頼してください');

  const workDir = jobWorkDir(job.id);
  fs.mkdirSync(workDir, { recursive: true });
  const settings: AiSettings = await loadAiSettings();
  for (const s of Object.values(steps)) {
    const problem = providerProblem(s.provider, settings);
    if (problem) return finish(job.id, 'failed', problem);
  }
  const claudeBin = settings.claudeBin!;
  if (!fs.existsSync(claudeBin)) return finish(job.id, 'failed', `Claude Code が見つかりません: ${claudeBin}`);

  // 構成案・リサーチ手法・禁止事項は依頼した時点の写しを使う
  const input: JobPromptInput = {
    jobId: job.id,
    repoDir,
    workDir,
    theme: job.theme,
    channel: job.account,
    template: job.templateBody ? { name: job.templateName ?? '（名前なし）', body: job.templateBody } : DEFAULT_TEMPLATE,
    researchMethod: job.researchMethodBody ? { name: job.researchMethodName ?? '（名前なし）', body: job.researchMethodBody } : DEFAULT_RESEARCH_METHOD,
    prohibitions: job.prohibitionsJson === null ? DEFAULT_PROHIBITIONS : safeJson<string[]>(job.prohibitionsJson, []),
  };
  // 点検で台本を直すときに参照する（作業フォルダの外のソースは読めないため、コピーする）
  fs.copyFileSync(path.join(repoDir, 'agent/examples/project.example.json'), path.join(workDir, 'example-project.json'));
  fs.copyFileSync(path.join(repoDir, 'remotion/types.ts'), path.join(workDir, 'scene-types.ts'));

  // ---------- 1. リサーチ ----------
  await setPhase(job.id, 'research');
  const researchPrompt = buildResearchPrompt(input);
  fs.writeFileSync(path.join(workDir, 'prompt-research.md'), researchPrompt);
  note(workDir, { kind: 'text', text: `リサーチを始めます（${PROVIDER_LABEL[steps.research.provider]}・${steps.research.model}）` });
  const research = await runClaudeAgent(job.id, workDir, claudeBin, steps.research.model, researchPrompt, [`status`, `trend:add`]);
  if (await canceled(job.id)) return;
  const trendId = (await prisma.agentJob.findUnique({ where: { id: job.id } }))?.trendResearchId;
  const trend = trendId ? await prisma.trendResearch.findUnique({ where: { id: trendId } }) : null;
  if (!trend) {
    return finish(job.id, 'failed', research.code !== 0 ? `リサーチの工程が失敗しました（終了コード ${research.code}）${research.stderr ? `: ${research.stderr.slice(-500)}` : ''}` : 'リサーチが登録されないまま終わりました');
  }
  const researchResult: ResearchResult = {
    topic: trend.topic,
    angle: trend.suggestedAngle,
    summary: trend.summary ?? '',
    sources: safeJson<{ title: string; url: string }[]>(trend.sourcesJson, []),
  };

  // ---------- 2. 台本 ----------
  await setPhase(job.id, 'script');
  const knowledge = await prisma.agentKnowledge.findMany({ where: { accountId: job.accountId }, orderBy: { confidenceScore: 'desc' }, take: 10 });
  const example = safeJson<{ lines?: unknown[] }>(fs.readFileSync(path.join(repoDir, 'agent/examples/project.example.json'), 'utf-8'), {});
  // 制作の設定のうち「おまかせ」の分は、台本と一緒に選ばせる（BGM の選択肢が「なし」だけなら選ばせない）。
  // BGM の「なし」は空の文字列だと選択肢として扱えない AI があるため、"none" で渡す
  const request = parseProduceRequest(job.produceJson) ?? { voice: null, speed: null, bgm: null };
  const voices = voiceOptions();
  const bgms = bgmOptions().map((b) => ({ ...b, id: b.id || 'none' }));
  const askBgm = request.bgm === null && bgms.length > 1;
  const scriptPrompt = buildScriptPrompt(input, {
    research: researchResult,
    knowledge: knowledge.map((k) => k.ruleText),
    sceneTypes: fs.readFileSync(path.join(repoDir, 'remotion/types.ts'), 'utf-8'),
    exampleLines: JSON.stringify((example.lines ?? []).slice(0, 3), null, 2),
    produce: { request: { ...request, bgm: askBgm ? null : request.bgm ?? '' }, voices, speeds: SPEED_OPTIONS, bgms, charsPerSecAt1x: CHARS_PER_SEC_AT_1X },
  });
  const schema = projectSchema({
    voice: request.voice === null ? voices.map((v) => v.id) : undefined,
    speed: request.speed === null ? SPEED_OPTIONS.map(String) : undefined,
    bgm: askBgm ? bgms.map((b) => b.id) : undefined,
  });
  fs.writeFileSync(path.join(workDir, 'prompt-script.md'), scriptPrompt);
  note(workDir, { kind: 'text', text: `台本を書いています（${PROVIDER_LABEL[steps.script.provider]}・${steps.script.model}）` });
  const projectFile = path.join(workDir, 'project.json');
  let feedback = '';
  let created = false;
  let produce: ProduceSettings | null = null;
  for (let attempt = 1; attempt <= 2 && !created; attempt++) {
    let answer: ProjectAnswer;
    try {
      answer = await runProviderJson<ProjectAnswer>(steps.script.provider, steps.script.model, SCRIPT_SYSTEM_PROMPT, scriptPrompt + feedback, schema, settings);
    } catch (error) {
      return finish(job.id, 'failed', `台本の工程で AI を呼べませんでした: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (await canceled(job.id)) return;
    const { produce: chosen, ...spec } = answer;
    produce = resolveProduce(request, chosen ? { ...chosen, bgm: chosen.bgm === 'none' ? '' : chosen.bgm } : null);
    fs.writeFileSync(projectFile, JSON.stringify({ trendId: trend.id, ...spec }, null, 2));
    const r = await runCli(job.id, workDir, ['project:create', projectFile, '--job', job.id]);
    if (r.code === 0) created = true;
    else {
      note(workDir, { kind: 'text', text: `台本の形に問題がありました: ${r.output.slice(-300)}` });
      // 形が正しくなかったら、理由を添えて1回だけ書き直させる
      feedback = `\n\n## 前回の答えの問題\n${r.output.slice(-1000)}\nこれを直して、全体をもう一度返してください。`;
    }
  }
  if (!created) return finish(job.id, 'failed', '台本の工程で、登録できる形の台本ができませんでした');
  const projectId = (await prisma.agentJob.findUnique({ where: { id: job.id } }))?.projectId;
  if (!projectId) return finish(job.id, 'failed', '企画が依頼に紐づいていません');

  // ---------- 3. 制作 ----------
  if (await canceled(job.id)) return;
  await setPhase(job.id, 'produce');
  // 制作の設定（依頼で選んだもの + おまかせの分は台本の担当が選んだもの）。動画に記録され、点検での作り直しも同じ設定になる
  const settingsFor = produce!;
  const auto = [request.voice === null && '声', request.speed === null && '速さ', request.bgm === null && 'BGM'].filter(Boolean);
  const produceFlags = ['--voice', settingsFor.voice, '--speed', String(settingsFor.speed), ...(settingsFor.bgm ? ['--bgm', settingsFor.bgm] : [])];
  note(workDir, { kind: 'text', text: `動画を作っています（${produceLabel(settingsFor)}${auto.length > 0 ? `。おまかせ: ${auto.join('・')}` : ''}）` });
  const produced = await runCli(job.id, workDir, ['produce', projectId, ...produceFlags]);
  if (await canceled(job.id)) return;
  if (produced.code !== 0) return finish(job.id, 'failed', `制作に失敗しました: ${produced.output.slice(-500)}`);

  // ---------- 4. 点検 ----------
  await setPhase(job.id, 'check');
  const clip = await prisma.shortClip.findFirst({ where: { projectId } });
  const checkPrompt = buildCheckPrompt(input, { projectId, research: researchResult, researchReport: research.result, durationSec: clip?.durationSec ?? null });
  fs.writeFileSync(path.join(workDir, 'prompt-check.md'), checkPrompt);
  note(workDir, { kind: 'text', text: `点検を始めます（${PROVIDER_LABEL[steps.check.provider]}・${steps.check.model}）` });
  const check = await runClaudeAgent(job.id, workDir, claudeBin, steps.check.model, checkPrompt, [`project:update ${projectId}`, `produce ${projectId}`]);
  if (await canceled(job.id)) return;

  const latest = await prisma.agentJob.findUnique({ where: { id: job.id }, include: { project: { include: { shortClips: true } } } });
  const rendered = Boolean(latest?.project?.shortClips[0]?.renderedFilePath);
  if (check.code === 0 && rendered) return finish(job.id, 'succeeded');
  return finish(job.id, 'failed', check.code !== 0 ? `点検の工程が失敗しました（終了コード ${check.code}）${check.stderr ? `: ${check.stderr.slice(-500)}` : ''}` : '点検のあと、動画がない状態で終わりました');
}

main()
  .catch(async (error) => {
    console.error(error);
    const jobId = process.argv[2];
    if (jobId) await finish(jobId, 'failed', error instanceof Error ? error.message : String(error)).catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
