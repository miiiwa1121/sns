import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR, FONT, fitFontSize } from '../theme';

// 字幕の文字領域の幅（1080 - 左右余白）
const CAPTION_WIDTH = 940;
// 文字サイズの見積もりに使う幅。強調語の左右の余白と縁取りの分だけ狭く見積もる
const FIT_WIDTH = 860;

// caption を強調語とそれ以外に分割する（長い語から優先して一致させる）
function splitByEmphasis(text: string, emphasis: string[]): { text: string; em: boolean }[] {
  const words = [...emphasis].filter(Boolean).sort((a, b) => b.length - a.length);
  if (words.length === 0) return [{ text, em: false }];
  const parts: { text: string; em: boolean }[] = [];
  let rest = text;
  while (rest.length > 0) {
    let hitIndex = -1;
    let hitWord = '';
    for (const w of words) {
      const i = rest.indexOf(w);
      if (i !== -1 && (hitIndex === -1 || i < hitIndex)) {
        hitIndex = i;
        hitWord = w;
      }
    }
    if (hitIndex === -1) {
      parts.push({ text: rest, em: false });
      break;
    }
    if (hitIndex > 0) parts.push({ text: rest.slice(0, hitIndex), em: false });
    parts.push({ text: hitWord, em: true });
    rest = rest.slice(hitIndex + hitWord.length);
  }
  return parts;
}

export const Caption: React.FC<{ text: string; emphasis?: string[] }> = ({ text, emphasis = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 200 } });
  const fontSize = fitFontSize(text, FIT_WIDTH, 48, 84);
  const parts = splitByEmphasis(text, emphasis);

  return (
    <div
      style={{
        width: CAPTION_WIDTH,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize,
        fontWeight: 900,
        lineHeight: 1.35,
        color: COLOR.text,
        lineBreak: 'strict',
        whiteSpace: 'pre-line',
        transform: `scale(${0.85 + pop * 0.15})`,
        opacity: pop,
        // 背景になじませつつ輪郭を出すため、白いにじみを付ける
        textShadow: `0 0 12px ${COLOR.white}, 0 0 4px ${COLOR.white}`,
      }}
    >
      {parts.map((p, i) =>
        p.em ? (
          <span
            key={i}
            style={{
              color: COLOR.primaryDeep,
              background: `linear-gradient(transparent 62%, ${COLOR.primarySoft} 62%)`,
              padding: '0 4px',
            }}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </div>
  );
};
