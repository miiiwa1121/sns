// エージェント（Claude Code セッション）がリサーチ→台本→制作→承認→配信→計測→分析を回すための CLI。
// 使い方は docs/operations/agent-runbook.md を参照。`npm run agent -- <command> ...`
import './env';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { safeJson } from '../src/lib/json';
import { PlatformType } from '../src/lib/types';
import { extractYouTubeVideoId, publishProject, recordManualPublish, PLATFORMS } from '../src/lib/services/publishService';
import { analyzeProject, parsePlatformMetrics, recordMetrics } from '../src/lib/services/analyticsService';
import { fetchYouTubeMetrics } from '../src/lib/analytics/youtubeMetrics';
import { produceShort, ScriptLine } from './produce';
import { Scene } from '../remotion/types';
import { validateScriptLines } from '../src/lib/script';
import { DEFAULT_PRODUCE, parseProduce, type ProduceSettings } from '../src/lib/services/produceSettings';
import { nextAction } from '../src/lib/workflow';
import { projectWorkDir, resolveMediaPath } from '../src/lib/storage';
import { execFileSync } from 'child_process';


// ---------- 引数 ----------

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=', 2);
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[key] = argv[++i];
      else flags[key] = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

class UsageError extends Error {}

function need(value: string | undefined, name: string): string {
  if (!value) throw new UsageError(`${name} を指定してください`);
  return value;
}

function readJsonFile(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (error) {
    throw new UsageError(`JSON ファイルを読めませんでした: ${file} (${error instanceof Error ? error.message : error})`);
  }
}

function isPlatform(p: string): p is PlatformType {
  return (PLATFORMS as string[]).includes(p);
}

// --account がなければ、依頼で動いているときは依頼のアカウント、それ以外は一覧の先頭。
// 依頼で動いているときに別のアカウントを指定したら断る（別のアカウントの知見を読んだり、リサーチを登録したりしないように）
async function resolveAccount(slug?: string) {
  const jobId = process.env.AGENT_JOB_ID;
  const job = jobId ? await prisma.agentJob.findUnique({ where: { id: jobId }, include: { account: true } }) : null;
  const account = slug
    ? await prisma.account.findUnique({ where: { slug } })
    : job?.account ?? (await prisma.account.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!account) throw new UsageError(slug ? `アカウント ${slug} が見つかりません` : 'アカウントが登録されていません');
  if (job && account.id !== job.accountId) throw new UsageError(`この依頼のアカウントは ${job.account.slug} です（${account.slug} は使えません）`);
  return account;
}

async function findProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { account: true, shortClips: true, publishLogs: true, analytics: true, trendResearch: true },
  });
  if (!project) throw new UsageError(`プロジェクト ${id} が見つかりません`);
  return project;
}

// ---------- コマンド ----------

async function status(flags: Record<string, string | true>) {
  const account = await resolveAccount(flags.account as string | undefined);
  const handles = await prisma.platformConnection.findMany({ where: { accountId: account.id } });
  console.log(`📺 ${account.name} (${account.slug})`);
  console.log(`   ${handles.map((h) => `${h.platform}:${h.handle || '-'}`).join('  ')}`);

  const trends = await prisma.trendResearch.findMany({ where: { accountId: account.id }, orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(`\n🔎 リサーチ（最新${trends.length}件）`);
  for (const t of trends) console.log(`   ${t.id}  ${t.createdAt.toLocaleDateString('ja-JP')}  ${t.topic}`);

  const projects = await prisma.project.findMany({
    where: { accountId: account.id },
    include: { shortClips: true, publishLogs: true, analytics: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log(`\n🎬 プロジェクト（最新${projects.length}件）`);
  for (const p of projects) {
    const clip = p.shortClips[0];
    const logs = PLATFORMS.map((pf) => `${pf}:${p.publishLogs.find((l) => l.platform === pf)?.status ?? '-'}`).join(' ');
    console.log(`   ${p.id}  [${p.stage}]  ${p.title}`);
    console.log(`      動画: ${clip?.renderedFilePath ?? '未レンダリング'}  承認: ${clip?.readyToPublish ? '済' : '未'}  ${logs}  実測: ${p.analytics.length}媒体`);
    console.log(`      次: ${nextActionHint(p)}`);
  }
}

// 工程の判定は src/lib/workflow.ts（管理画面と共通）。CLI では対応するコマンドを添える
function nextActionHint(p: Parameters<typeof nextAction>[0] & { id: string }): string {
  const a = nextAction(p);
  const owner = a.owner === 'you' ? '[ユーザー]' : a.owner === 'agent' ? '[エージェント]' : '';
  const hint = [
    `project:update ${p.id} <file.json>`,
    `produce ${p.id}`,
    `ユーザーに管理画面で確認・承認してもらう（http://127.0.0.1:3001/projects/${p.id}）`,
    '管理画面で YouTube 投稿・投稿 URL の記録',
    '管理画面で数字を入力（YouTube は自動取得可）',
  ][a.step];
  if (a.owner === 'done') return '完了';
  return `${owner} ${a.label} → ${hint}${a.dueAt ? `（${a.dueAt.toLocaleString('ja-JP')} 以降）` : ''}`;
}

async function trendAdd(file: string, flags: Record<string, string | true>) {
  const account = await resolveAccount(flags.account as string | undefined);
  const body = readJsonFile(file) as Record<string, unknown>;
  const sources = body.sources;
  if (typeof body.topic !== 'string' || !body.topic) throw new UsageError('topic は必須です');
  if (typeof body.angle !== 'string' || !body.angle) throw new UsageError('angle（切り口）は必須です');
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    !sources.every((s) => s && typeof s.title === 'string' && typeof s.url === 'string' && /^https?:\/\//.test(s.url))
  ) {
    throw new UsageError('sources は [{ "title": ..., "url": "https://..." }] を1件以上指定してください（出典の無いリサーチは登録しない）');
  }

  const trend = await prisma.trendResearch.create({
    data: {
      accountId: account.id,
      topic: body.topic,
      category: typeof body.category === 'string' ? body.category : account.category,
      suggestedAngle: body.angle,
      summary: typeof body.summary === 'string' ? body.summary : null,
      sourcesJson: JSON.stringify(sources),
    },
  });
  // 依頼のリサーチの工程で登録したら、依頼に記録する（次の台本の工程がこのリサーチを使う）
  if (process.env.AGENT_JOB_ID) await prisma.agentJob.update({ where: { id: process.env.AGENT_JOB_ID }, data: { trendResearchId: trend.id } });
  console.log(`✅ リサーチを登録しました: ${trend.id}  ${trend.topic}`);
}

interface ProjectSpec {
  trendId?: string;
  title: string;
  concept: string;
  lines: ScriptLine[];
  publish: {
    youtube?: { title?: string; description?: string; tags?: string[] };
    tiktok?: { caption?: string; tags?: string[] };
    instagram?: { caption?: string; tags?: string[] };
    x?: { text?: string };
  };
}

function validateProjectSpec(raw: unknown): ProjectSpec {
  const s = raw as ProjectSpec;
  if (!s || typeof s.title !== 'string' || !s.title) throw new UsageError('title は必須です');
  if (typeof s.concept !== 'string' || !s.concept) throw new UsageError('concept は必須です');
  const lineError = validateScriptLines(s.lines);
  if (lineError) throw new UsageError(lineError);
  if (!s.publish || typeof s.publish !== 'object') throw new UsageError('publish は必須です');
  const ytTitle = s.publish.youtube?.title ?? s.title;
  if (ytTitle.length > 100) throw new UsageError(`YouTube タイトルは100文字以内です（${ytTitle.length}文字）`);
  // X は日本語1文字を2としてカウントし、上限280
  const xText = s.publish.x?.text ?? '';
  const xWeight = [...xText].reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2fff ? 2 : 1), 0);
  if (xWeight > 280) throw new UsageError(`X の本文が長すぎます（重み ${xWeight} / 280）`);
  return s;
}

async function projectCreate(file: string, flags: Record<string, string | true>) {
  const spec = validateProjectSpec(readJsonFile(file));
  // 管理画面からの依頼（AgentJob）で作る場合は、依頼と企画を紐づける
  const jobId = typeof flags.job === 'string' ? flags.job : process.env.AGENT_JOB_ID;
  const job = jobId ? await prisma.agentJob.findUnique({ where: { id: jobId } }) : null;
  if (jobId && !job) throw new UsageError(`依頼 ${jobId} が見つかりません`);
  const account = spec.trendId
    ? (await prisma.trendResearch.findUnique({ where: { id: spec.trendId }, include: { account: true } }))?.account
    : await resolveAccount(flags.account as string | undefined);
  if (!account) throw new UsageError(`リサーチ ${spec.trendId} が見つかりません`);
  // 依頼で作る企画は、依頼で選んだアカウントのもの（リサーチが別のアカウントに登録されていたら断る）
  if (job && account.id !== job.accountId) throw new UsageError(`リサーチ ${spec.trendId} は、この依頼のアカウントのものではありません。trend:add に --account を付けて登録し直してください`);

  const tagsJson = (tags?: string[]) => (tags && tags.length > 0 ? JSON.stringify(tags) : null);
  const withTags = (text: string | undefined, tags?: string[]) =>
    [text, tags?.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n\n') || null;

  const project = await prisma.project.create({
    data: {
      accountId: account.id,
      trendResearchId: spec.trendId ?? null,
      // 依頼で作る場合は、依頼で選んだ構成案を記録する
      templateId: job?.templateId ?? null,
      title: spec.title,
      concept: spec.concept,
      stage: 'production',
      targetAudience: account.targetAudience,
      shortClips: {
        create: {
          title: spec.title,
          startTimeSec: 0,
          endTimeSec: 0,
          durationSec: 0,
          hookSentence: spec.lines[0].caption ?? spec.lines[0].text,
          scriptJson: JSON.stringify(spec.lines),
          readyToPublish: false,
        },
      },
      publishLogs: {
        create: [
          {
            platform: 'youtube',
            title: spec.publish.youtube?.title ?? spec.title,
            caption: spec.publish.youtube?.description ?? null,
            tagsJson: tagsJson(spec.publish.youtube?.tags),
          },
          {
            platform: 'tiktok',
            caption: withTags(spec.publish.tiktok?.caption, spec.publish.tiktok?.tags),
            tagsJson: tagsJson(spec.publish.tiktok?.tags),
          },
          {
            platform: 'instagram',
            caption: withTags(spec.publish.instagram?.caption, spec.publish.instagram?.tags),
            tagsJson: tagsJson(spec.publish.instagram?.tags),
          },
          { platform: 'x', caption: spec.publish.x?.text ?? null },
        ],
      },
    },
  });
  if (job) await prisma.agentJob.update({ where: { id: job.id }, data: { projectId: project.id } });
  console.log(`✅ プロジェクトを作成しました: ${project.id}  ${project.title}`);
  console.log(`   次: npm run agent -- produce ${project.id}`);
}

/**
 * 未配信のプロジェクトの台本・投稿文を差し替える（作り直し用）。動画は produce で作り直す
 */
async function projectUpdate(projectId: string, file: string) {
  const project = await findProject(projectId);
  if (project.publishLogs.some((l) => l.status === 'published')) {
    throw new UsageError('配信済みのプロジェクトは差し替えられません（新しく project:create する）');
  }
  const spec = validateProjectSpec(readJsonFile(file));
  const clip = project.shortClips[0];
  const tagsJson = (tags?: string[]) => (tags && tags.length > 0 ? JSON.stringify(tags) : null);
  const withTags = (text: string | undefined, tags?: string[]) =>
    [text, tags?.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n\n') || null;
  const logData: Record<PlatformType, { title?: string | null; caption: string | null; tagsJson?: string | null }> = {
    youtube: { title: spec.publish.youtube?.title ?? spec.title, caption: spec.publish.youtube?.description ?? null, tagsJson: tagsJson(spec.publish.youtube?.tags) },
    tiktok: { caption: withTags(spec.publish.tiktok?.caption, spec.publish.tiktok?.tags), tagsJson: tagsJson(spec.publish.tiktok?.tags) },
    instagram: { caption: withTags(spec.publish.instagram?.caption, spec.publish.instagram?.tags), tagsJson: tagsJson(spec.publish.instagram?.tags) },
    x: { caption: spec.publish.x?.text ?? null },
  };

  await prisma.$transaction([
    prisma.project.update({ where: { id: project.id }, data: { title: spec.title, concept: spec.concept, stage: 'production' } }),
    prisma.shortClip.update({
      where: { id: clip.id },
      data: {
        title: spec.title,
        hookSentence: spec.lines[0].caption ?? spec.lines[0].text,
        scriptJson: JSON.stringify(spec.lines),
        renderedFilePath: null,
        renderedScriptJson: null,
        readyToPublish: false,
      },
    }),
    ...project.publishLogs.map((l) =>
      prisma.publishLog.update({ where: { id: l.id }, data: { ...logData[l.platform as PlatformType], status: 'draft', errorMessage: null } })
    ),
  ]);
  console.log(`✅ 台本を差し替えました: ${project.id}  ${spec.title}`);
  console.log(`   次: npm run agent -- produce ${project.id}`);
}

async function produce(projectId: string, flags: Record<string, string | true>) {
  const project = await findProject(projectId);
  const clip = project.shortClips[0];
  const lines = safeJson<ScriptLine[]>(clip?.scriptJson, []);
  if (!clip || lines.length === 0) throw new UsageError('このプロジェクトには台本（ShortClip.scriptJson）がありません');

  const handle = (await prisma.platformConnection.findFirst({ where: { accountId: project.accountId, platform: 'youtube' } }))?.handle || '';
  console.log(`🎬 制作: ${project.title}`);
  // 制作の設定（声の指定は agent/tts.ts を参照）: 引数 > この動画を前に作ったときの設定（作り直しは同じ声で）> 既定
  const base = parseProduce(clip.produceJson) ?? DEFAULT_PRODUCE;
  const settings: ProduceSettings = {
    voice: typeof flags.voice === 'string' ? flags.voice : base.voice,
    speed: typeof flags.speed === 'string' ? Number(flags.speed) : base.speed,
    bgm: typeof flags.bgm === 'string' ? flags.bgm : base.bgm,
  };
  if (!Number.isFinite(settings.speed) || settings.speed < 0.5 || settings.speed > 2) throw new UsageError('--speed は 0.5〜2.0 の数値です');
  const result = await produceShort({
    projectId: project.id,
    title: project.title,
    brandName: project.account.name,
    handle,
    lines,
    voice: settings.voice,
    speed: settings.speed,
    bgmSrc: settings.bgm || null,
  });

  // 声のクレジット（VOICEVOX の利用規約で必要）を投稿文の末尾に入れる。X は文字数が厳しいので動画内の表記に任せる。
  // 声を変えて作り直したときに前の声のクレジットが残らないよう、いったん消してから入れ直す
  for (const log of project.publishLogs.filter((l) => l.platform !== 'x')) {
    const base = (log.caption ?? '').replace(/\n*音声: VOICEVOX:[^\n]*/g, '').trim();
    const caption = result.credit ? `${base}\n\n音声: ${result.credit}`.trim() : base;
    if (caption !== (log.caption ?? '')) await prisma.publishLog.update({ where: { id: log.id }, data: { caption: caption || null } });
  }

  await prisma.$transaction([
    prisma.shortClip.update({
      where: { id: clip.id },
      data: {
        renderedFilePath: result.videoRelPath,
        // どの台本で作った動画か（台本を直した後に作り直したかの判定に使う）
        renderedScriptJson: clip.scriptJson,
        // どの設定で作った動画か（作り直しも同じ声・速さ・BGM で行う）
        produceJson: JSON.stringify(settings),
        durationSec: Math.round(result.durationSec),
        endTimeSec: Math.round(result.durationSec),
        // 作り直したら承認はやり直し
        readyToPublish: false,
      },
    }),
    prisma.project.update({ where: { id: project.id }, data: { stage: 'review' } }),
  ]);

  console.log(`✅ 動画: data/${result.videoRelPath}（${result.durationSec.toFixed(1)}秒）`);
  console.log(`   確認用静止画: ${path.relative(process.cwd(), result.previewPath)}`);
  console.log(`   絵コンテ: ${await writeStoryboard(project.id)}`);
  if (result.durationSec > 60) console.log('   ⚠️ 60秒を超えています。Instagram / 一部の Shorts 扱いで不利になる可能性があります');
}

// ---------- 絵コンテ（構成の記録） ----------

const STORYBOARD_DIR = path.resolve('docs/videos');

function describeScene(scene?: Scene): string {
  if (!scene) return '（前の場面を継続）';
  const oneLine = (t: string) => t.replace(/\n/g, ' ');
  switch (scene.type) {
    case 'hook': return `フック「${oneLine(scene.text)}」${scene.sub ? `＋バッジ「${scene.sub}」` : ''}`;
    case 'keyword': return `キーワード「${oneLine(scene.text)}」${scene.label ? `（${scene.label}）` : ''}`;
    case 'compare': return `比較「${scene.left.label}: ${oneLine(scene.left.body)}」→「${scene.right.label}: ${oneLine(scene.right.body)}」`;
    case 'chat': return `チャット再現「${scene.user}」→ ${{ text: '文章', table: '表', bill: '割り勘ツール', chart: 'グラフ', calculator: '計算機' }[scene.reply.type]}`;
    case 'timeline': return `ステップ ${scene.steps.map((st) => `${st.label}${st.detail ? `(${st.detail})` : ''}`).join(' → ')}`;
    case 'chips': return `チップ ${scene.items.join(' / ')}`;
    case 'select': return `選択UI ${scene.options.join(' / ')}`;
    case 'outro': return `締め${scene.text ? `「${scene.text}」` : ''}`;
  }
}

const fmtSec = (frames: number) => `${(frames / 30).toFixed(1)}s`;
const cell = (t: string) => t.replace(/\n/g, '<br>').replace(/\|/g, '\\|');

/**
 * 動画の構成を docs/videos/ に記録する（produce の後に自動で呼ぶ）
 */
async function writeStoryboard(projectId: string): Promise<string> {
  const project = await findProject(projectId);
  const clip = project.shortClips[0];
  const propsPath = path.join(projectWorkDir(project.id), 'props.json');
  if (!clip?.renderedFilePath || !fs.existsSync(propsPath)) throw new UsageError('未レンダリングです（先に produce）');
  const props = JSON.parse(fs.readFileSync(propsPath, 'utf-8')) as { lines: { durationInFrames: number }[]; credit?: string | null };
  const script = safeJson<ScriptLine[]>(clip.scriptJson, []);

  const date = project.createdAt.toLocaleDateString('sv-SE').replace(/-/g, '');
  const baseName = `${date}-${project.id}`;
  const imageRel = `img/${baseName}.jpg`;
  const previewPng = path.join(projectWorkDir(project.id), 'preview.png');
  if (fs.existsSync(previewPng)) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', previewPng, '-vf', 'scale=1620:-1', '-q:v', '4', path.join(STORYBOARD_DIR, imageRel)]);
  }

  let start = 0;
  const rows = script.map((line, i) => {
    const dur = props.lines[i]?.durationInFrames ?? 0;
    const row = `| ${i + 1} | ${fmtSec(start)}–${fmtSec(start + dur)} | ${cell(describeScene(line.scene))} | ${line.mood ?? '（継続）'} | ${cell(line.caption ?? line.text)} | ${cell(line.text)} |`;
    start += dur;
    return row;
  });
  const sources = safeJson<{ title: string; url: string }[]>(project.trendResearch?.sourcesJson, []);
  const logs = PLATFORMS.map((pf) => {
    const l = project.publishLogs.find((x) => x.platform === pf);
    return `| ${pf} | ${l?.status ?? '-'} | ${l?.postUrl ?? ''} |`;
  });

  const md = [
    `# 絵コンテ: ${project.title}`,
    '',
    `- プロジェクトID: \`${project.id}\``,
    `- 状態: ${project.stage}`,
    `- 尺: ${(start / 30).toFixed(1)} 秒（${script.length} 行）`,
    `- 動画ファイル: \`data/${clip.renderedFilePath}\`（Git 管理外）`,
    `- 声: ${props.credit ?? '-'}`,
    `- 狙い: ${project.concept}`,
    '',
    '## 構成',
    '',
    '| # | 時間 | 場面 | 表情 | 字幕 | 読み上げ |',
    '| :-- | :-- | :-- | :-- | :-- | :-- |',
    ...rows,
    '',
    '## 全行のコマ',
    '',
    fs.existsSync(path.join(STORYBOARD_DIR, imageRel)) ? `![全行のコマ](${imageRel})` : '（画像なし）',
    '',
    '## 出典',
    '',
    ...(sources.length > 0 ? sources.map((src) => `- [${src.title}](${src.url})`) : ['（なし）']),
    '',
    '## 配信',
    '',
    '| 媒体 | 状態 | URL |',
    '| :-- | :-- | :-- |',
    ...logs,
    '',
  ].join('\n');
  const mdPath = path.join(STORYBOARD_DIR, `${baseName}.md`);
  fs.writeFileSync(mdPath, md);

  // 目次（README）に未登録なら追記する
  const readme = path.join(STORYBOARD_DIR, 'README.md');
  const index = fs.readFileSync(readme, 'utf-8');
  if (!index.includes(`(${baseName}.md)`)) {
    fs.writeFileSync(readme, `${index.trimEnd()}\n- [${baseName}.md](${baseName}.md): ${project.title}\n`);
  }
  return path.relative(process.cwd(), mdPath);
}

async function storyboard(projectId: string) {
  console.log(`✅ 絵コンテを書き出しました: ${await writeStoryboard(projectId)}`);
}

async function approve(projectId: string) {
  const project = await findProject(projectId);
  const clip = project.shortClips[0];
  if (!clip?.renderedFilePath) throw new UsageError('未レンダリングのため承認できません（先に produce）');
  await prisma.shortClip.update({ where: { id: clip.id }, data: { readyToPublish: true } });
  console.log(`✅ 承認しました: ${project.title}`);
  console.log('   ※ 承認は人間の判断を記録するコマンド。エージェントはユーザーの明示的な OK を得てから実行する（runbook 参照）');
}

async function publish(projectId: string, flags: Record<string, string | true>) {
  const raw = typeof flags.platforms === 'string' ? flags.platforms.split(',') : [];
  if (raw.length === 0) throw new UsageError('--platforms youtube のように投稿先を明示してください');
  const platforms = raw.map((p) => {
    if (!isPlatform(p)) throw new UsageError(`不明なプラットフォーム: ${p}`);
    return p;
  });
  const privacy = flags['youtube-privacy'];
  if (privacy !== undefined && privacy !== 'public' && privacy !== 'unlisted' && privacy !== 'private') {
    throw new UsageError('--youtube-privacy は public / unlisted / private のいずれかです');
  }

  const outcome = await publishProject(projectId, { platforms, youtubePrivacy: privacy });
  if (!outcome.ok) throw new UsageError(outcome.error);
  const logs = await prisma.publishLog.findMany({ where: { projectId } });
  for (const p of outcome.succeeded) {
    console.log(`✅ ${p}: ${logs.find((l) => l.platform === p)?.postUrl ?? '(URL なし)'}`);
  }
  for (const f of outcome.failed) console.log(`❌ ${f.platform}: ${f.message}`);
  if (outcome.succeeded.length === 0) process.exitCode = 1;
  else console.log(`   絵コンテ更新: ${await writeStoryboard(projectId)}`);
}

async function exportManual(projectId: string) {
  const project = await findProject(projectId);
  const clip = project.shortClips[0];
  if (!clip?.renderedFilePath) throw new UsageError('未レンダリングです（先に produce）');
  if (!clip.readyToPublish) throw new UsageError('未承認です（承認前の動画は書き出さない）');

  const dir = path.join(projectWorkDir(project.id), 'manual');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(resolveMediaPath(clip.renderedFilePath) ?? '', path.join(dir, 'video.mp4'));
  const log = (p: PlatformType) => project.publishLogs.find((l) => l.platform === p);
  const md = [
    `# 手動投稿パッケージ: ${project.title}`,
    `投稿したら \`npm run agent -- publish:record ${project.id} <platform> <URL>\` で記録する。`,
    `## TikTok\n\n${log('tiktok')?.caption ?? '(未設定)'}`,
    `## Instagram Reels\n\n${log('instagram')?.caption ?? '(未設定)'}`,
    `## X\n\n${log('x')?.caption ?? '(未設定)'}`,
    `## YouTube（API 投稿できない場合）\n\nタイトル: ${log('youtube')?.title ?? project.title}\n\n${log('youtube')?.caption ?? ''}`,
  ].join('\n\n') + '\n';
  fs.writeFileSync(path.join(dir, 'captions.md'), md);
  console.log(`✅ 書き出しました: ${path.relative(process.cwd(), dir)}/ (video.mp4, captions.md)`);
}

async function publishRecord(projectId: string, platform: string, url: string) {
  if (!isPlatform(platform)) throw new UsageError(`不明なプラットフォーム: ${platform}`);
  if (!/^https?:\/\//.test(url)) throw new UsageError('URL は http(s):// で始まる必要があります');
  if (platform === 'youtube' && !extractYouTubeVideoId(url)) {
    throw new UsageError('YouTube の動画URL（https://youtube.com/shorts/<ID> など）を指定してください');
  }
  await findProject(projectId);
  await recordManualPublish(projectId, platform, url);
  console.log(`✅ ${platform} の投稿を記録しました: ${url}`);
  console.log(`   絵コンテ更新: ${await writeStoryboard(projectId)}`);
}

async function metricsCollect(projectId: string) {
  const project = await findProject(projectId);
  const yt = project.publishLogs.find((l) => l.platform === 'youtube' && l.status === 'published');
  if (!yt?.externalId || !yt.publishedAt) {
    throw new UsageError('投稿済みの YouTube 動画がありません（手動投稿なら publish:record で URL を記録。他媒体は metrics:record で手入力）');
  }
  const result = await fetchYouTubeMetrics(project.account.slug, yt.externalId, yt.publishedAt);
  if (!result.ok) throw new UsageError(result.error);
  const recordError = await recordMetrics(project.id, [result.metric]);
  if (recordError) throw new UsageError(recordError);
  const m = result.metric;
  console.log(`✅ YouTube: 再生 ${m.views} / 高評価 ${m.likes} / コメント ${m.comments} / シェア ${m.shares} / 平均視聴率 ${m.retentionRate ?? '未取得'}`);
  if (!result.retentionAvailable) console.log('   ⚠️ 平均視聴率は YouTube Analytics にまだ反映されていません（1〜2日後に再取得）');
}

async function metricsRecord(projectId: string, file: string) {
  await findProject(projectId);
  const parsed = parsePlatformMetrics((readJsonFile(file) as { platforms?: unknown }).platforms);
  if (typeof parsed === 'string') throw new UsageError(parsed);
  const recordError = await recordMetrics(projectId, parsed);
  if (recordError) throw new UsageError(recordError);
  console.log(`✅ 実測値を記録しました: ${parsed.map((p) => p.platform).join(', ')}`);
}

async function analyze(projectId: string, flags: Record<string, string | true>) {
  const outcome = await analyzeProject(projectId, flags['save-knowledge'] === true);
  if (!outcome.ok) throw new UsageError(outcome.error);
  const d = outcome.diagnosis;
  console.log(`📊 ${d.summary}`);
  d.strengths.forEach((s) => console.log(`   + ${s}`));
  d.weaknesses.forEach((w) => console.log(`   - ${w}`));
  if (outcome.persistedKnowledge) console.log(`🧠 知見を保存しました: ${outcome.persistedKnowledge.ruleText}`);
  else if (!d.actionableKnowledge) console.log('   （再生数が少ないため知見は作っていません）');
}

async function knowledge(flags: Record<string, string | true>) {
  const account = await resolveAccount(flags.account as string | undefined);
  const items = await prisma.agentKnowledge.findMany({
    where: { accountId: account.id },
    orderBy: { confidenceScore: 'desc' },
    take: 10,
  });
  if (items.length === 0) console.log('（まだ知見はありません）');
  for (const k of items) console.log(`[${k.category}] ${k.ruleText}（信頼度 ${Math.round(k.confidenceScore * 100)}%）`);
}

// ---------- エントリポイント ----------

const USAGE = `使い方: npm run agent -- <command>
  status                                   現在の状態と各プロジェクトの次の手順
  trend:add <file.json>                    リサーチを登録（出典必須）
  project:create <file.json>               台本・投稿文からプロジェクトを作成
  project:update <projectId> <file.json>   未配信プロジェクトの台本・投稿文を差し替え
  produce <projectId> [--voice voicevox:<キャラ>:<スタイル>] [--speed 1.15] [--bgm bgm/<file>]
                                           音声合成 + レンダリング + 確認用静止画
  storyboard <projectId>                   絵コンテを docs/videos/ に書き出す（produce で自動実行）
  approve <projectId>                      公開承認（ユーザーの OK を得てから）
  publish <projectId> --platforms youtube [--youtube-privacy private|unlisted|public]
  export:manual <projectId>                手動投稿用に動画とキャプションを書き出す
  publish:record <projectId> <platform> <url>  手動投稿の結果を記録
  metrics:collect <projectId>              YouTube の実測値を API で取得
  metrics:record <projectId> <file.json>   実測値を手入力
  analyze <projectId> [--save-knowledge]   実測値の分析（知見の保存）
  knowledge                                蓄積された知見（次の台本に反映する）`;

// Antigravity は「動画ができたか」で完了とみなすが、その後も点検・作り直しを続けるため、完了（または中止）からこの間は作業中として扱う
const ANTIGRAVITY_GRACE_MS = 30 * 60 * 1000;

/**
 * AI が作業中の依頼。あれば説明の文字列を返す。
 * Claude Code は依頼のプロセスに AGENT_JOB_ID を渡すので上で断れるが、Antigravity は IDE で動くため環境変数が渡らない。
 * そこで、作業中の依頼があるあいだは、誰が打ったコマンドでも人の判断が必要な操作を断る（管理画面のボタンは CLI を通らないので影響しない）
 */
async function workingJob(): Promise<string | null> {
  const since = new Date(Date.now() - ANTIGRAVITY_GRACE_MS);
  const job = await prisma.agentJob.findFirst({
    where: {
      OR: [
        { status: 'running' },
        { provider: 'antigravity', status: { in: ['succeeded', 'canceled'] }, finishedAt: { gte: since } },
      ],
    },
    include: { account: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!job) return null;
  const label = `${job.account.name}・${job.theme ?? 'おまかせ'}`;
  if (job.status === 'running') return label;
  const until = new Date(job.finishedAt!.getTime() + ANTIGRAVITY_GRACE_MS);
  return `${label}。Antigravity は ${until.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} まで作業中とみなします`;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional: [a, b, c], flags } = parseArgs(rest);

  // 管理画面からの依頼で AI が動いているときは、人の判断が必要な操作を拒否する（指示書の禁止事項に加えた鍵）
  const HUMAN_ONLY = ['approve', 'publish', 'publish:record', 'metrics:record', 'metrics:collect', 'analyze'];
  if (HUMAN_ONLY.includes(command)) {
    if (process.env.AGENT_JOB_ID) throw new UsageError(`「${command}」は人が管理画面で行う操作です（依頼で動くエージェントは実行できません）`);
    const blocker = await workingJob();
    if (blocker) throw new UsageError(`AI が作業中の依頼（${blocker}）があるため、「${command}」はコマンドからは実行できません。管理画面から行うか、作業が終わってから実行してください`);
  }

  switch (command) {
    case 'status': return status(flags);
    case 'trend:add': return trendAdd(need(a, 'file.json'), flags);
    case 'project:create': return projectCreate(need(a, 'file.json'), flags);
    case 'project:update': return projectUpdate(need(a, 'projectId'), need(b, 'file.json'));
    case 'produce': return produce(need(a, 'projectId'), flags);
    case 'approve': return approve(need(a, 'projectId'));
    case 'storyboard': return storyboard(need(a, 'projectId'));
    case 'publish': return publish(need(a, 'projectId'), flags);
    case 'export:manual': return exportManual(need(a, 'projectId'));
    case 'publish:record': return publishRecord(need(a, 'projectId'), need(b, 'platform'), need(c, 'url'));
    case 'metrics:collect': return metricsCollect(need(a, 'projectId'));
    case 'metrics:record': return metricsRecord(need(a, 'projectId'), need(b, 'file.json'));
    case 'analyze': return analyze(need(a, 'projectId'), flags);
    case 'knowledge': return knowledge(flags);
    default:
      console.log(USAGE);
      if (command) process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof UsageError ? `❌ ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
