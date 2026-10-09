// エージェント（Claude Code セッション）がリサーチ→台本→制作→承認→配信→計測→分析を回すための CLI。
// 使い方は docs/operations/agent-runbook.md を参照。`npm run agent -- <command> ...`
import './env';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/lib/prisma';
import { safeJson } from '../../src/lib/projectMapper';
import { PlatformType } from '../../src/lib/types';
import { extractYouTubeVideoId, publishProject, recordManualPublish, PLATFORMS } from '../../src/lib/services/publishService';
import { analyzeProject, parsePlatformMetrics, recordMetrics } from '../../src/lib/services/analyticsService';
import { fetchYouTubeMetrics } from '../../src/lib/analytics/youtubeMetrics';
import { produceShort, ScriptLine } from './produce';

const DEFAULT_VOICE = 'ja-JP-NanamiNeural';
const DEFAULT_RATE = '+10%';

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

async function resolveAccount(slug?: string) {
  const account = slug
    ? await prisma.account.findUnique({ where: { slug } })
    : await prisma.account.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!account) throw new UsageError(slug ? `アカウント ${slug} が見つかりません` : 'アカウントが登録されていません');
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
    console.log(`      次: ${nextAction(p, clip)}`);
  }
}

function nextAction(
  p: { id: string; stage: string; analytics: unknown[]; publishLogs: { status: string }[] },
  clip?: { renderedFilePath: string | null; readyToPublish: boolean }
): string {
  if (!clip) return '台本が無い（project:create で作り直す）';
  if (!clip.renderedFilePath) return `produce ${p.id}`;
  if (!clip.readyToPublish) return `プレビューをユーザーに見せて承認を得る → approve ${p.id}`;
  if (!p.publishLogs.some((l) => l.status === 'published')) return `publish ${p.id} --platforms youtube / export:manual ${p.id}`;
  if (p.analytics.length === 0) return `metrics:collect ${p.id}（公開から1〜2日後）/ 手動投稿分は metrics:record`;
  if (p.stage !== 'analyzed') return `analyze ${p.id} --save-knowledge`;
  return '完了（実測値を更新したら analyze で再分析できる）';
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
  if (!Array.isArray(s.lines) || s.lines.length === 0 || s.lines.length > 30) {
    throw new UsageError('lines は1〜30行で指定してください');
  }
  for (const [i, l] of s.lines.entries()) {
    if (!l || typeof l.text !== 'string' || !l.text.trim()) throw new UsageError(`lines[${i}].text が空です`);
    if (l.caption !== undefined && typeof l.caption !== 'string') throw new UsageError(`lines[${i}].caption は文字列です`);
  }
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
  const account = spec.trendId
    ? (await prisma.trendResearch.findUnique({ where: { id: spec.trendId }, include: { account: true } }))?.account
    : await resolveAccount(flags.account as string | undefined);
  if (!account) throw new UsageError(`リサーチ ${spec.trendId} が見つかりません`);

  const tagsJson = (tags?: string[]) => (tags && tags.length > 0 ? JSON.stringify(tags) : null);
  const withTags = (text: string | undefined, tags?: string[]) =>
    [text, tags?.map((t) => `#${t}`).join(' ')].filter(Boolean).join('\n\n') || null;

  const project = await prisma.project.create({
    data: {
      accountId: account.id,
      trendResearchId: spec.trendId ?? null,
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
  console.log(`✅ プロジェクトを作成しました: ${project.id}  ${project.title}`);
  console.log(`   次: npm run agent -- produce ${project.id}`);
}

async function produce(projectId: string, flags: Record<string, string | true>) {
  const project = await findProject(projectId);
  const clip = project.shortClips[0];
  const lines = safeJson<ScriptLine[]>(clip?.scriptJson, []);
  if (!clip || lines.length === 0) throw new UsageError('このプロジェクトには台本（ShortClip.scriptJson）がありません');

  const handle = (await prisma.platformConnection.findFirst({ where: { accountId: project.accountId, platform: 'youtube' } }))?.handle || '';
  console.log(`🎬 制作: ${project.title}`);
  const result = produceShort({
    projectId: project.id,
    title: project.title,
    brandName: project.account.name,
    handle,
    lines,
    voice: typeof flags.voice === 'string' ? flags.voice : DEFAULT_VOICE,
    rate: typeof flags.rate === 'string' ? flags.rate : DEFAULT_RATE,
  });

  await prisma.$transaction([
    prisma.shortClip.update({
      where: { id: clip.id },
      data: {
        renderedFilePath: result.videoFileName,
        durationSec: Math.round(result.durationSec),
        endTimeSec: Math.round(result.durationSec),
        // 作り直したら承認はやり直し
        readyToPublish: false,
      },
    }),
    prisma.project.update({ where: { id: project.id }, data: { stage: 'review' } }),
  ]);

  console.log(`✅ 動画: public/videos/${result.videoFileName}（${result.durationSec.toFixed(1)}秒）`);
  console.log(`   確認用静止画: ${path.relative(process.cwd(), result.previewPath)}`);
  if (result.durationSec > 60) console.log('   ⚠️ 60秒を超えています。Instagram / 一部の Shorts 扱いで不利になる可能性があります');
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
}

async function exportManual(projectId: string) {
  const project = await findProject(projectId);
  const clip = project.shortClips[0];
  if (!clip?.renderedFilePath) throw new UsageError('未レンダリングです（先に produce）');
  if (!clip.readyToPublish) throw new UsageError('未承認です（承認前の動画は書き出さない）');

  const dir = path.resolve('out/agent', project.id, 'manual');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.resolve('public/videos', path.basename(clip.renderedFilePath)), path.join(dir, 'video.mp4'));
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
}

async function metricsCollect(projectId: string) {
  const project = await findProject(projectId);
  const yt = project.publishLogs.find((l) => l.platform === 'youtube' && l.status === 'published');
  if (!yt?.externalId || !yt.publishedAt) {
    throw new UsageError('投稿済みの YouTube 動画がありません（手動投稿なら publish:record で URL を記録。他媒体は metrics:record で手入力）');
  }
  const result = await fetchYouTubeMetrics(yt.externalId, yt.publishedAt);
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
  produce <projectId> [--voice] [--rate]   音声合成 + レンダリング + 確認用静止画
  approve <projectId>                      公開承認（ユーザーの OK を得てから）
  publish <projectId> --platforms youtube [--youtube-privacy private|unlisted|public]
  export:manual <projectId>                手動投稿用に動画とキャプションを書き出す
  publish:record <projectId> <platform> <url>  手動投稿の結果を記録
  metrics:collect <projectId>              YouTube の実測値を API で取得
  metrics:record <projectId> <file.json>   実測値を手入力
  analyze <projectId> [--save-knowledge]   実測値の分析（知見の保存）
  knowledge                                蓄積された知見（次の台本に反映する）`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional: [a, b, c], flags } = parseArgs(rest);

  switch (command) {
    case 'status': return status(flags);
    case 'trend:add': return trendAdd(need(a, 'file.json'), flags);
    case 'project:create': return projectCreate(need(a, 'file.json'), flags);
    case 'produce': return produce(need(a, 'projectId'), flags);
    case 'approve': return approve(need(a, 'projectId'));
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
