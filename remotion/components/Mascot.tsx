import React from 'react';
import { COLOR } from '../theme';
import { Mood } from '../types';

// アイコン（remotion/public/brand/icon.svg）の白い丸キャラ。表情（mood）と口の開き（mouth: 0〜1）を受け取って描く
export const Mascot: React.FC<{
  mood: Mood;
  mouth: number;
  frame: number; // 揺れなどの周期アニメーション用（グローバルなフレーム）
  enterFrame: number; // この表情になってからのフレーム数
  size: number;
}> = ({ mood, mouth, frame, enterFrame, size }) => {
  const stroke = COLOR.line;
  const sw = 10;

  // 表情ごとの動き
  const bob = Math.sin(frame / 9) * 6;
  const shake = mood === 'panic' ? Math.sin(frame * 1.7) * 5 : 0;
  const jump = mood === 'surprised' ? -Math.max(0, 40 - enterFrame * 4) : 0;
  const nod = mood === 'nod' ? Math.abs(Math.sin(frame / 5)) * 10 : 0;
  const tilt = mood === 'think' ? -8 : mood === 'panic' ? Math.sin(frame * 0.9) * 4 : 0;

  const eyes = (() => {
    switch (mood) {
      case 'panic':
        return (
          <g stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <polyline points="95,130 125,148 95,166" />
            <polyline points="205,130 175,148 205,166" />
          </g>
        );
      case 'surprised':
        return (
          <g fill={stroke}>
            <circle cx={115} cy={145} r={15} />
            <circle cx={185} cy={145} r={15} />
            <circle cx={120} cy={140} r={5} fill={COLOR.white} />
            <circle cx={190} cy={140} r={5} fill={COLOR.white} />
          </g>
        );
      case 'happy':
        return (
          <g stroke={stroke} strokeWidth={sw} strokeLinecap="round" fill="none">
            <path d="M95 152 Q 115 128 135 152" />
            <path d="M165 152 Q 185 128 205 152" />
          </g>
        );
      case 'think':
        return (
          <g fill={stroke}>
            <circle cx={120} cy={138} r={10} />
            <circle cx={185} cy={138} r={10} />
          </g>
        );
      case 'nod':
      default:
        return (
          <g fill={stroke}>
            <circle cx={115} cy={145} r={10} />
            <circle cx={185} cy={145} r={10} />
          </g>
        );
    }
  })();

  const mouthShape = (() => {
    if (mouth > 0.12) {
      // 話している: 開き具合に応じた楕円
      return <ellipse cx={150} cy={198} rx={22} ry={6 + mouth * 20} fill={stroke} />;
    }
    if (mood === 'panic') {
      return (
        <g>
          <rect x={122} y={186} width={56} height={26} rx={8} fill={COLOR.white} stroke={stroke} strokeWidth={8} />
          <line x1={122} y1={199} x2={178} y2={199} stroke={stroke} strokeWidth={5} />
        </g>
      );
    }
    if (mood === 'surprised') return <ellipse cx={150} cy={200} rx={14} ry={16} fill={stroke} />;
    if (mood === 'think') return <path d="M130 200 Q 150 192 170 200" stroke={stroke} strokeWidth={8} fill="none" strokeLinecap="round" />;
    return <path d="M125 190 Q 150 215 175 190" stroke={stroke} strokeWidth={8} fill="none" strokeLinecap="round" />;
  })();

  const sweat = mood === 'panic' || mood === 'think';
  const sweatFall = (frame % 30) / 30;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 300"
      style={{ transform: `translate(${shake}px, ${bob + jump + nod}px) rotate(${tilt}deg)`, overflow: 'visible' }}
    >
      {/* 体 */}
      <circle cx={150} cy={160} r={112} fill={COLOR.white} stroke={stroke} strokeWidth={sw} />
      <ellipse cx={88} cy={188} rx={20} ry={11} fill={COLOR.cheek} />
      <ellipse cx={212} cy={188} rx={20} ry={11} fill={COLOR.cheek} />
      {eyes}
      {mouthShape}
      {/* 汗 */}
      {sweat && (
        <g fill={COLOR.sweat} stroke={stroke} strokeWidth={6} strokeLinejoin="round">
          <path
            transform={`translate(0 ${sweatFall * 24})`}
            opacity={1 - sweatFall * 0.6}
            d="M262 70 C 248 96 242 112 256 124 C 270 134 288 122 284 104 C 281 90 270 80 262 70 Z"
          />
          {mood === 'panic' && <path d="M36 110 C 26 128 22 140 32 148 C 42 156 54 147 52 134 C 50 124 42 116 36 110 Z" />}
        </g>
      )}
      {/* 驚き: 頭の上の「！」 */}
      {mood === 'surprised' && enterFrame < 40 && (
        <text x={240} y={40} fontSize={70} fontWeight={900} fill={COLOR.sweat} stroke={stroke} strokeWidth={4}>
          !
        </text>
      )}
    </svg>
  );
};
