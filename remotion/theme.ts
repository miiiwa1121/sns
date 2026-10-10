// 動画の配色: 白と水色を基調にしたシンプルな画面（2026-10-10 ユーザー指定）
export const COLOR = {
  bg: '#F3F8FC', // 背景（ごく薄い水色がかった白）
  surface: '#FFFFFF', // カード
  surfaceSub: '#F1F7FC', // カード内の入力欄など
  border: '#D6E6F3',
  primary: '#38BDF8', // 水色
  primaryDeep: '#0284C7', // 強調文字・ボタン
  primarySoft: '#E0F2FE', // 強調のマーカー・チップ
  text: '#0F172A',
  sub: '#475569',
  muted: '#94A3B8',
  // マスコット
  line: '#0F172A',
  white: '#FFFFFF',
  sweat: '#38BDF8',
  cheek: '#FFB4B4',
};

export const SHADOW = '0 12px 40px rgba(2, 132, 199, 0.12)';

export const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

// 全角1文字 = 1、半角 = 0.7 として行の幅を見積もる（太字の英大文字・数字は 0.6em より広いため余裕を持たせる）
export function lineUnits(line: string): number {
  return [...line].reduce((acc, ch) => acc + (ch.charCodeAt(0) < 0x2000 ? 0.7 : 1), 0);
}

/**
 * 一番長い行が availablePx に1行で収まる文字サイズ（[min, max] の範囲）。
 * \n 区切りを1行として扱うため、意図しない位置での折り返し（「精一 / 杯」など）を防げる。
 */
export function fitFontSize(text: string, availablePx: number, min: number, max: number): number {
  const longest = Math.max(...text.split('\n').map(lineUnits), 1);
  return Math.max(min, Math.min(max, Math.floor(availablePx / longest)));
}
