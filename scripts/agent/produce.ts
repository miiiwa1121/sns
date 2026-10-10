import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import type { Mood, Scene, ShortVideoProps } from '../../src/remotion/types';
import { createTts } from './tts';

export interface ScriptLine {
  text: string; // 読み上げる文（読みを整えるためにカタカナ表記にしてよい）
  caption?: string; // 画面に出す字幕（省略時は text）
  emphasis?: string[]; // 字幕の中で強調する語
  scene?: Scene; // この行から切り替える場面（省略時は直前の場面を引き継ぐ）
  mood?: Mood; // マスコットの表情（省略時は直前の行を引き継ぐ）
}

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
  bgmSrc: string | null; // public/ からの相対パス
}

export interface ProduceResult {
  videoFileName: string; // public/videos/ 配下
  durationSec: number;
  previewPath: string; // 確認用の静止画（字幕1行1コマの一覧）
  credit: string | null; // 声のクレジット（概要欄にも書く）
}

/**
 * ナレーション音声の合成 → Remotion レンダリング → 確認用静止画の書き出し。
 * 外部コマンドはすべて execFileSync（シェルを通さない）で呼ぶ。台本の文字列がコマンドとして解釈されないようにするため。
 */
export async function produceShort(input: ProduceInput): Promise<ProduceResult> {
  const audioDirRel = path.posix.join('audio', input.projectId);
  const audioDir = path.resolve('public', audioDirRel);
  const workDir = path.resolve('out/agent', input.projectId);
  if (input.bgmSrc && !fs.existsSync(path.resolve('public', input.bgmSrc))) {
    throw new Error(`BGM ファイルが見つかりません: public/${input.bgmSrc}`);
  }
  fs.rmSync(audioDir, { recursive: true, force: true });
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });

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

  const videoFileName = `${input.projectId}.mp4`;
  const videoPath = path.resolve('public/videos', videoFileName);
  // 同梱の chrome-headless-shell はサンドボックス環境で起動に失敗することがあるため、既定ではシステムの Chrome を使う
  const browser = process.env.REMOTION_BROWSER_EXECUTABLE || (fs.existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined);
  const renderArgs = [
    'remotion', 'render', 'src/remotion/index.ts', 'Short', videoPath,
    `--props=${propsPath}`,
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
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.5', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=540:-1', '-q:v', '4', videoPath.replace(/\.mp4$/, '.jpg')]);
  const previewPath = writePreview(lines, videoPath, workDir);
  return { videoFileName, durationSec, previewPath, credit: tts.credit };
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
  return previewPath;
}
