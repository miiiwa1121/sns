import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/storage';
import { safeJson } from '@/lib/json';

/**
 * 動画づくりの依頼の「制作」の設定（声・話す速さ・BGM）。AI は使わず、システムが音声合成（VOICEVOX / Edge）とレンダリング（Remotion）を行う。
 * 「作成する」で依頼ごとに選ぶ。既定は「おまかせ」で、台本の担当 AI が内容に合わせて選択肢の中から選ぶ（agent/job-runner.ts）。
 * 動画を作ったときの設定は ShortClip.produceJson に残し、作り直しも同じ設定で行う。
 */
export type ProduceSettings = { voice: string; speed: number; bgm: string };
// 依頼で選んだもの（null は「おまかせ」）
export type ProduceRequest = { voice: string | null; speed: number | null; bgm: string | null };

// AI の選んだものが使えないとき・設定の記録がない動画を作り直すときに使う（2026-10-10 ユーザー選択の声と速さ）
export const DEFAULT_PRODUCE: ProduceSettings = { voice: 'voicevox:ずんだもん:ノーマル', speed: 1.15, bgm: '' };

export const SPEED_OPTIONS = [0.9, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3];

// 読み上げ（text）の1秒あたりの字数は、およそ 5.4 × 速さ（場面の切り替えの間を含む）。
// 2026-10-11 に作った5本（ずんだもん・1.15倍）で 5.9〜6.5 字/秒（平均 6.2）だったことから
export const CHARS_PER_SEC_AT_1X = 5.4;

// VOICEVOX の声の一覧は、エンジンを起動しないと取れない。取れたときにここへ残し、選択肢に使う
const VOICEVOX_CACHE = path.join(DATA_DIR, 'voicevox-speakers.json');
type VoicevoxSpeaker = { name: string; styles: { name: string }[] };

// edge-tts の日本語の声（2つだけ）
const EDGE_VOICES = [
  { id: 'edge:ja-JP-NanamiNeural', label: 'Edge: Nanami（女性）' },
  { id: 'edge:ja-JP-KeitaNeural', label: 'Edge: Keita（男性）' },
];

const BGM_DIR = path.resolve(process.cwd(), 'remotion/public/bgm');

export function parseProduce(json: string | null | undefined): ProduceSettings | null {
  const v = safeJson<Partial<ProduceSettings> | null>(json, null);
  return v && typeof v.voice === 'string' && typeof v.speed === 'number' ? { voice: v.voice, speed: v.speed, bgm: v.bgm ?? '' } : null;
}

export function parseProduceRequest(json: string | null | undefined): ProduceRequest | null {
  const v = safeJson<Partial<ProduceRequest> | null>(json, null);
  if (!v) return null;
  return { voice: typeof v.voice === 'string' ? v.voice : null, speed: typeof v.speed === 'number' ? v.speed : null, bgm: typeof v.bgm === 'string' ? v.bgm : null };
}

export function voiceLabel(voice: string): string {
  const [kind, a, b] = voice.split(':');
  if (kind === 'voicevox') return `VOICEVOX: ${a}（${b ?? 'ノーマル'}）`;
  return EDGE_VOICES.find((v) => v.id === voice)?.label ?? voice;
}

const bgmLabel = (bgm: string) => (bgm ? path.basename(bgm) : 'なし');

export function produceLabel(p: ProduceSettings): string {
  return `${voiceLabel(p.voice)}・${p.speed}倍・BGM ${bgmLabel(p.bgm)}`;
}

export function produceRequestLabel(r: ProduceRequest): string {
  return `声 ${r.voice ? voiceLabel(r.voice) : 'おまかせ'}・速さ ${r.speed ? `${r.speed}倍` : 'おまかせ'}・BGM ${r.bgm === null ? 'おまかせ' : bgmLabel(r.bgm)}`;
}

export function saveVoicevoxSpeakers(speakers: VoicevoxSpeaker[]) {
  fs.mkdirSync(path.dirname(VOICEVOX_CACHE), { recursive: true });
  fs.writeFileSync(VOICEVOX_CACHE, JSON.stringify(speakers.map((s) => ({ name: s.name, styles: s.styles.map((st) => ({ name: st.name })) }))));
}

export function voicevoxListed(): boolean {
  return fs.existsSync(VOICEVOX_CACHE);
}

function edgeInstalled(): boolean {
  return (process.env.PATH ?? '').split(':').some((dir) => dir && fs.existsSync(path.join(dir, 'edge-tts')));
}

/** 選べる声（VOICEVOX は読み込んだ一覧。読み込む前は既定の声だけ。Edge は edge-tts が入っていれば） */
export function voiceOptions(): { id: string; label: string }[] {
  const speakers = safeJson<VoicevoxSpeaker[]>(fs.existsSync(VOICEVOX_CACHE) ? fs.readFileSync(VOICEVOX_CACHE, 'utf-8') : null, []);
  const out = speakers.flatMap((s) => s.styles.map((st) => ({ id: `voicevox:${s.name}:${st.name}`, label: voiceLabel(`voicevox:${s.name}:${st.name}`) })));
  if (!out.some((v) => v.id === DEFAULT_PRODUCE.voice)) out.unshift({ id: DEFAULT_PRODUCE.voice, label: voiceLabel(DEFAULT_PRODUCE.voice) });
  if (edgeInstalled()) out.push(...EDGE_VOICES);
  return out;
}

/** 選べる BGM（なし + remotion/public/bgm/ の音楽ファイル） */
export function bgmOptions(): { id: string; label: string }[] {
  const files = fs.existsSync(BGM_DIR) ? fs.readdirSync(BGM_DIR).filter((f) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(f)).sort() : [];
  return [{ id: '', label: 'なし' }, ...files.map((f) => ({ id: `bgm/${f}`, label: f }))];
}

/** 依頼で選んだもの（おまかせ以外）が選択肢にあるか */
export function validateProduceRequest(r: ProduceRequest): string | null {
  if (r.voice !== null && !voiceOptions().some((v) => v.id === r.voice)) return '選べない声です';
  if (r.speed !== null && !SPEED_OPTIONS.includes(r.speed)) return '話す速さが正しくありません';
  if (r.bgm !== null && !bgmOptions().some((b) => b.id === r.bgm)) return '選べない BGM です';
  return null;
}

/** おまかせの分を AI の答えで埋める。AI の答えが選択肢になければ既定を使う */
export function resolveProduce(r: ProduceRequest, ai: { voice?: string; speed?: string | number; bgm?: string } | null): ProduceSettings {
  const voice = r.voice ?? (ai?.voice && voiceOptions().some((v) => v.id === ai.voice) ? ai.voice : DEFAULT_PRODUCE.voice);
  const aiSpeed = Number(ai?.speed);
  const speed = r.speed ?? (SPEED_OPTIONS.includes(aiSpeed) ? aiSpeed : DEFAULT_PRODUCE.speed);
  const bgm = r.bgm ?? (ai?.bgm !== undefined && bgmOptions().some((b) => b.id === ai.bgm) ? ai.bgm : DEFAULT_PRODUCE.bgm);
  return { voice, speed, bgm };
}
