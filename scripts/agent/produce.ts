import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import type { ShortVideoProps } from '../../src/remotion/ShortVideo';

export interface ScriptLine {
  text: string; // 読み上げる文（読みを整えるためにカタカナ表記にしてよい）
  caption?: string; // 画面に出す字幕（省略時は text）
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
  voice: string;
  rate: string; // edge-tts の --rate（例: "+10%"）
}

export interface ProduceResult {
  videoFileName: string; // public/videos/ 配下
  durationSec: number;
  previewPath: string; // 確認用の静止画（3コマ横並び）
}

/**
 * ナレーション音声の合成 → Remotion レンダリング → 確認用静止画の書き出し。
 * 外部コマンドはすべて execFileSync（シェルを通さない）で呼ぶ。台本の文字列がコマンドとして解釈されないようにするため。
 */
export function produceShort(input: ProduceInput): ProduceResult {
  const audioDirRel = path.posix.join('audio', input.projectId);
  const audioDir = path.resolve('public', audioDirRel);
  const workDir = path.resolve('out/agent', input.projectId);
  fs.rmSync(audioDir, { recursive: true, force: true });
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });

  // 1. 行ごとに音声合成し、長さを測る
  const lines: ShortVideoProps['lines'] = input.lines.map((line, i) => {
    const fileName = `line-${String(i).padStart(2, '0')}.mp3`;
    const filePath = path.join(audioDir, fileName);
    execFileSync('edge-tts', ['--voice', input.voice, `--rate=${input.rate}`, '--text', line.text, '--write-media', filePath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const seconds = Number(
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath]).toString().trim()
    );
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(`音声の長さを取得できませんでした: ${filePath}`);
    }
    console.log(`  🎙️ ${i + 1}/${input.lines.length} ${seconds.toFixed(1)}秒: ${line.text}`);
    return {
      caption: line.caption ?? line.text,
      audioSrc: path.posix.join(audioDirRel, fileName),
      durationInFrames: Math.ceil(seconds * FPS) + GAP_FRAMES,
    };
  });

  // 2. Remotion でレンダリング
  const props: ShortVideoProps = { title: input.title, brandName: input.brandName, handle: input.handle, lines };
  const propsPath = path.join(workDir, 'props.json');
  fs.writeFileSync(propsPath, JSON.stringify(props, null, 2));

  const videoFileName = `${input.projectId}.mp4`;
  const videoPath = path.resolve('public/videos', videoFileName);
  // 同梱の chrome-headless-shell はサンドボックス環境で起動に失敗することがあるため、既定ではシステムの Chrome を使う
  const browser = process.env.REMOTION_BROWSER_EXECUTABLE || (fs.existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined);
  console.log('  🎬 レンダリング中...');
  execFileSync(
    'npx',
    [
      'remotion', 'render', 'src/remotion/index.ts', 'Short', videoPath,
      `--props=${propsPath}`,
      '--log=error',
      ...(browser ? [`--browser-executable=${browser}`] : []),
    ],
    { stdio: 'inherit' }
  );

  const durationSec = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]).toString().trim()
  );

  // 3. 確認用に 15% / 50% / 85% 地点のコマを横に並べた静止画を作る
  const previewPath = path.join(workDir, 'preview.png');
  const frames = [0.15, 0.5, 0.85].map((ratio, i) => {
    const framePath = path.join(workDir, `frame-${i}.png`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (durationSec * ratio).toFixed(2), '-i', videoPath, '-frames:v', '1', framePath]);
    return framePath;
  });
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    ...frames.flatMap((f) => ['-i', f]),
    '-filter_complex', '[0][1][2]hstack=inputs=3,scale=1620:-1',
    previewPath,
  ]);

  return { videoFileName, durationSec, previewPath };
}
