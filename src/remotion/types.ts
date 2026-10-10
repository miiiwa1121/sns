// ショート動画の台本・場面の型。scripts/agent（台本 JSON）と Remotion コンポジションで共用する。
// Remotion の props は Record<string, unknown> を満たす必要があるため、interface ではなく type で定義する。
// 場面は絵文字やスタンプを使わず、UI 部品で表現する（2026-10-10 ユーザー指定）。

export type Mood = 'panic' | 'surprised' | 'happy' | 'think' | 'nod';

export type ChatReply =
  | { type: 'text'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'bill'; total: number; people: number }
  | { type: 'chart'; title?: string; bars: { label: string; value: number }[] }
  | { type: 'calculator'; expression: string; result: string };

export type Scene =
  // 冒頭のつかみ。大きな文字と小さなバッジ
  | { type: 'hook'; text: string; sub?: string }
  // 要点を1つ大きく見せるカード
  | { type: 'keyword'; label?: string; text: string }
  // 左右の比較（Before / After など）
  | { type: 'compare'; left: { label: string; body: string }; right: { label: string; body: string } }
  // チャット画面の再現。ユーザーの質問 → 考え中 → 返答（表・図・ツールなど）
  | { type: 'chat'; user: string; reply: ChatReply }
  // 日付や手順のステップが順に進む
  | { type: 'timeline'; title?: string; steps: { label: string; detail?: string }[] }
  // できることなどをチップで並べる
  | { type: 'chips'; title?: string; items: string[] }
  // 選択肢の UI が自動で切り替わり、最後の1つ（selected 省略時）が選ばれる
  | { type: 'select'; title?: string; options: string[]; selected?: number }
  // 締め。ロゴとチャンネル名
  | { type: 'outro'; text?: string };

export const SCENE_TYPES: Scene['type'][] = ['hook', 'keyword', 'compare', 'chat', 'timeline', 'chips', 'select', 'outro'];
export const MOODS: Mood[] = ['panic', 'surprised', 'happy', 'think', 'nod'];

// 台本1行 = 読み上げ1回 = 字幕1枚。scene を省略した行は直前の場面を引き継ぐ
export type ShortVideoLine = {
  caption: string;
  audioSrc: string; // public/ からの相対パス
  durationInFrames: number;
  emphasis?: string[]; // 字幕の中で強調する語
  scene?: Scene;
  mood?: Mood;
};

export type ShortVideoProps = {
  title: string;
  brandName: string;
  handle: string;
  lines: ShortVideoLine[];
  bgmSrc?: string | null; // public/ からの相対パス。無ければ BGM なし
  credit?: string | null; // 画面下に小さく出すクレジット（例: "VOICEVOX:ずんだもん"）
};
