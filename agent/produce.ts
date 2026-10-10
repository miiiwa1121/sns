import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import type { ShortVideoProps } from '../remotion/types';
import type { ScriptLine } from '../src/lib/script';
import { DATA_DIR, projectWorkDir, videoRelPath, thumbRelPath } from '../src/lib/storage';
import { createTts } from './tts';

export type { ScriptLine } from '../src/lib/script';

const FPS = 30;
// 行と行の間の無音
const GAP_FRAMES = 6;
const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export interface ProduceInput {
  projectId: string;
  title: string;
  brandName: string;
  handle: string;
  lines: ScriptLine[];
  voice: string; // tts.ts の声の指定（例: "voicevox:ずんだもん:ノーマル"）
  speed: number; // 読み上げ速度（1.0 = 標準）
  bgmSrc: string | null; // remotion/public/ からの相対パス
}

export interface ProduceResult {
  videoRelPath: string; // data/ からの相対パス（DB の renderedFilePath に保存する）
  durationSec: number;
  previewPath: string; // 確認用の静止画（字幕1行1コマの一覧）
  credit: string | null; // 声のクレジット（概要欄にも書く）
}

/**
 * ナレーション音声の合成 → Remotion レンダリング → 確認用静止画の書き出し。
 * 外部コマンドはすべて execFileSync（シェルを通さない）で呼ぶ。台本の文字列がコマンドとして解釈されないようにするため。
 */
export async function produceShort(input: ProduceInput): Promise<ProduceResult> {
  const workDir = projectWorkDir(input.projectId);
  // Remotion に渡す素材置き場。固定素材（remotion/public/ の brand・se・BGM）と、この動画のナレーション音声を1か所に集める
  const stageDir = path.join(workDir, 'stage');
  const audioDirRel = 'audio';
  const audioDir = path.join(stageDir, audioDirRel);
  if (input.bgmSrc && !fs.existsSync(path.resolve('remotion/public', input.bgmSrc))) {
    throw new Error(`BGM ファイルが見つかりません: remotion/public/${input.bgmSrc}`);
  }
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.cpSync(path.resolve('remotion/public'), stageDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });

  // 1. 行ごとに音声合成し、長さを測る
  const tts = await createTts(input.voice, input.speed);
  const lines: ShortVideoProps['lines'] = [];
  try {
    for (const [i, line] of input.lines.entries()) {
      const filePath = await tts.synthesize(line.text, path.join(audioDir, `line-${String(i).padStart(2, '0')}`));
      lines.push(measureLine(i, input.lines.length, line, filePath, audioDirRel));
    }
  } finally {
    tts.close();
  }

  // 2. Remotion でレンダリング
  const props: ShortVideoProps = {
    title: input.title,
    brandName: input.brandName,
    handle: input.handle,
    lines,
    bgmSrc: input.bgmSrc,
    credit: tts.credit,
  };
  const propsPath = path.join(workDir, 'props.json');
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));

  const videoRel = videoRelPath(input.projectId);
  const videoPath = path.join(DATA_DIR, videoRel);
  // 同梱の chrome-headless-shell はサンドボックス環境で起動に失敗することがあるため、既定ではシステムの Chrome を使う
  const browser = process.env.REMOTION_BROWSER_EXECUTABLE || (fs.existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined);
  const renderArgs = [
    'remotion', 'render', 'remotion/index.ts', 'Short', videoPath,
    `--props=${propsPath}`,
    `--public-dir=${stageDir}`,
    '--log=error',
    ...(browser ? [`--browser-executable=${browser}`] : []),
  ];
  // Remotion の内部サーバーにブラウザが接続できず失敗することが稀にある（"Visited ... but got no response"）ため1回だけ再試行する
  for (let attempt = 1; ; attempt++) {
    console.log(`  🎬 レンダリング中...${attempt > 1 ? `（再試行 ${attempt}回目）` : ''}`);
    try {
      execFileSync('npx', renderArgs, { stdio: 'inherit' });
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }

  const durationSec = probeDuration(videoPath);
  // サムネイル（1.5秒目のコマ）。管理画面の動画一覧・プレーヤーの poster に使う
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.5', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=540:-1', '-q:v', '4', path.join(DATA_DIR, thumbRelPath(videoRel))]);
  const previewPath = writePreview(lines, videoPath, workDir);
  // 一時素材はレンダリングが終わったら不要（失敗したときは調査のため残す）
  fs.rmSync(stageDir, { recursive: true, force: true });
  return { videoRelPath: videoRel, durationSec, previewPath, credit: tts.credit };
}

function probeDuration(file: string): number {
  const seconds = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()
  );
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`長さを取得できませんでした: ${file}`);
  }
  return seconds;
}

function measureLine(
  i: number,
  total: number,
  line: ScriptLine,
  filePath: string,
  audioDirRel: string
): ShortVideoProps['lines'][number] {
  const seconds = probeDuration(filePath);
  console.log(`  🎙️ ${i + 1}/${total} ${seconds.toFixed(1)}秒: ${line.text}`);
  return {
    caption: line.caption ?? line.text,
    audioSrc: path.posix.join(audioDirRel, path.basename(filePath)),
    durationInFrames: Math.ceil(seconds * FPS) + GAP_FRAMES,
    emphasis: line.emphasis,
    scene: line.scene,
    mood: line.mood,
  };
}

/**
 * 確認用に、字幕1行につき1コマ（各行の 60% 地点）を6列で並べた静止画を作る。全字幕の誤字・折り返し・場面を1枚で点検できる
 */
function writePreview(lines: ShortVideoProps['lines'], videoPath: string, workDir: string): string {
  const previewPath = path.join(workDir, 'preview.png');
  const COLS = 6;
  let startFrame = 0;
  const frames = lines.map((line, i) => {
    const t = (startFrame + line.durationInFrames * 0.6) / FPS;
    startFrame += line.durationInFrames;
    const framePath = path.join(workDir, `frame-${String(i).padStart(2, '0')}.png`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', videoPath, '-frames:v', '1', '-vf', 'scale=360:-1', framePath]);
    return framePath;
  });
  // 最終行を空白コマで埋めて列数をそろえる
  const padded = [...frames];
  while (padded.length % COLS !== 0) padded.push('blank');
  const inputs = padded.flatMap((f) => (f === 'blank' ? ['-f', 'lavfi', '-i', 'color=c=black:s=360x640'] : ['-i', f]));
  const rows = Array.from({ length: padded.length / COLS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => `[${r * COLS + c}]`).join('') + `hstack=inputs=${COLS}[r${r}]`
  );
  const rowCount = rows.length;
  const filter = rowCount === 1
    ? rows[0].replace(/\[r0\]$/, '')
    : `${rows.join(';')};${Array.from({ length: rowCount }, (_, r) => `[r${r}]`).join('')}vstack=inputs=${rowCount}`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-frames:v', '1', previewPath]);
  // 1コマずつの中間画像は一覧（preview.png）にまとめたら不要
  for (const f of frames) fs.rmSync(f, { force: true });
  return previewPath;
}
