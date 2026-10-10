// 台本（1行 = 読み上げ1回 = 字幕1枚）の型と検証。CLI（project:create）と構成案の相談（試作）で共用する
import { MOODS, SCENE_TYPES, type Mood, type Scene, type ShortVideoLine } from '../../remotion/types';

export interface ScriptLine {
  text: string; // 読み上げる文（読みを整えるためにカタカナ表記にしてよい）
  caption?: string; // 画面に出す字幕（省略時は text）
  emphasis?: string[]; // 字幕の中で強調する語
  scene?: Scene; // この行から切り替える場面（省略時は直前の場面を引き継ぐ）
  mood?: Mood; // マスコットの表情（省略時は直前の行を引き継ぐ）
}

/** 台本の行を検証する。問題がなければ null、あれば理由 */
export function validateScriptLines(lines: unknown): string | null {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 30) return 'lines は1〜30行で指定してください';
  for (const [i, l] of (lines as ScriptLine[]).entries()) {
    if (!l || typeof l.text !== 'string' || !l.text.trim()) return `lines[${i}].text が空です`;
    if (l.caption !== undefined && typeof l.caption !== 'string') return `lines[${i}].caption は文字列です`;
    if (l.emphasis !== undefined && !(Array.isArray(l.emphasis) && l.emphasis.every((e) => typeof e === 'string'))) {
      return `lines[${i}].emphasis は文字列の配列です`;
    }
    if (l.mood !== undefined && !MOODS.includes(l.mood)) return `lines[${i}].mood は ${MOODS.join(' / ')} のいずれかです`;
    if (l.scene !== undefined && !(l.scene && SCENE_TYPES.includes(l.scene.type))) {
      return `lines[${i}].scene.type は ${SCENE_TYPES.join(' / ')} のいずれかです`;
    }
  }
  return null;
}

const FPS = 30;
// 読み上げの速さの目安（1秒あたりの文字数）。実際の音声の長さは音声合成で決まるため、プレビュー用の見積もり
const CHARS_PER_SEC = 7.5;

/** 音声なしのプレビュー用に、読み上げの長さを文字数から見積もって映像の行にする */
export function toPreviewLines(lines: ScriptLine[]): ShortVideoLine[] {
  return lines.map((l) => ({
    caption: l.caption ?? l.text,
    durationInFrames: Math.max(45, Math.ceil(([...l.text].length / CHARS_PER_SEC) * FPS) + 6),
    emphasis: l.emphasis,
    scene: l.scene,
    mood: l.mood,
  }));
}
