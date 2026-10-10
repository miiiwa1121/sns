import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChildProcess, execFileSync, spawn } from 'child_process';

// 声の指定:
//   "voicevox:<キャラクター名>:<スタイル名>"（例: "voicevox:ずんだもん:ノーマル"）
//   "edge:<voice>"（例: "edge:ja-JP-NanamiNeural"）
export interface Tts {
  synthesize(text: string, outPathWithoutExt: string): Promise<string>; // 書き出したファイルのパス
  credit: string | null; // 動画・概要欄に出すクレジット
  close(): void;
}

const VOICEVOX_URL = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const VOICEVOX_ENGINE = process.env.VOICEVOX_ENGINE_PATH || path.join(os.homedir(), '.local/share/voicevox/macos-arm64/run');

export async function createTts(spec: string, speed: number): Promise<Tts> {
  const [provider, ...rest] = spec.split(':');
  if (provider === 'edge') return createEdgeTts(rest.join(':') || 'ja-JP-NanamiNeural', speed);
  if (provider === 'voicevox') {
    const [character, style = 'ノーマル'] = rest;
    if (!character) throw new Error('声の指定は "voicevox:<キャラクター名>:<スタイル名>" の形式です');
    return createVoicevoxTts(character, style, speed);
  }
  throw new Error(`不明な声の指定です: ${spec}`);
}

function createEdgeTts(voice: string, speed: number): Tts {
  const rate = `${speed >= 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%`;
  return {
    credit: null,
    async synthesize(text, out) {
      const file = `${out}.mp3`;
      execFileSync('edge-tts', ['--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', file], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      return file;
    },
    close() {},
  };
}

async function engineAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${VOICEVOX_URL}/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * VOICEVOX エンジンに接続する。起動していなければこの場で起動し、close() で止める。
 */
async function createVoicevoxTts(character: string, style: string, speed: number): Promise<Tts> {
  let engine: ChildProcess | null = null;
  if (!(await engineAlive())) {
    if (!fs.existsSync(VOICEVOX_ENGINE)) {
      throw new Error(`VOICEVOX エンジンが見つかりません: ${VOICEVOX_ENGINE}（docs/operations/agent-runbook.md の前提を参照）`);
    }
    const { port, hostname } = new URL(VOICEVOX_URL);
    console.log('  🔈 VOICEVOX エンジンを起動しています...');
    engine = spawn(VOICEVOX_ENGINE, ['--host', hostname, '--port', port], { stdio: 'ignore' });
    const deadline = Date.now() + 120_000;
    while (!(await engineAlive())) {
      if (Date.now() > deadline || engine.exitCode !== null) {
        engine.kill();
        throw new Error('VOICEVOX エンジンの起動に失敗しました');
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const speakers = (await (await fetch(`${VOICEVOX_URL}/speakers`)).json()) as {
    name: string;
    styles: { name: string; id: number }[];
  }[];
  const speaker = speakers.find((s) => s.name === character);
  const styleId = speaker?.styles.find((s) => s.name === style)?.id;
  if (styleId === undefined) {
    engine?.kill();
    const available = speakers.map((s) => `${s.name}（${s.styles.map((st) => st.name).join('/')}）`).join(', ');
    throw new Error(`VOICEVOX の声が見つかりません: ${character}:${style}\n使える声: ${available}`);
  }

  return {
    // VOICEVOX の利用規約で求められるクレジット表記
    credit: `VOICEVOX:${character}`,
    async synthesize(text, out) {
      const queryRes = await fetch(`${VOICEVOX_URL}/audio_query?${new URLSearchParams({ text, speaker: String(styleId) })}`, { method: 'POST' });
      if (!queryRes.ok) throw new Error(`VOICEVOX audio_query に失敗しました (${queryRes.status})`);
      const query = await queryRes.json();
      query.speedScale = speed;
      query.prePhonemeLength = 0.05;
      query.postPhonemeLength = 0.1;
      const synthRes = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${styleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });
      if (!synthRes.ok) throw new Error(`VOICEVOX synthesis に失敗しました (${synthRes.status})`);
      const file = `${out}.wav`;
      fs.writeFileSync(file, Buffer.from(await synthRes.arrayBuffer()));
      return file;
    },
    close() {
      engine?.kill();
    },
  };
}
