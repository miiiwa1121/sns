import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ナレーション1行 = 字幕1枚 = 音声1ファイル。尺は音声の長さから CLI が計算して渡す
export interface ShortVideoLine {
  caption: string; // 画面に出す字幕
  audioSrc: string; // public/ からの相対パス
  durationInFrames: number;
}

// Remotion の props は Record<string, unknown> を満たす必要があるため interface ではなく type で定義する
export type ShortVideoProps = {
  title: string;
  brandName: string;
  handle: string;
  lines: ShortVideoLine[];
};

// 末尾に無音の余白を足し、最後の字幕が途切れて見えないようにする
export const TAIL_FRAMES = 20;

// ブランドカラー（docs/brand/icon.md）
const COLOR = {
  bg: '#1E1B2E',
  yellow: '#FFD43B',
  orange: '#FFB627',
  red: '#FF4D2E',
  white: '#FFFFFF',
  muted: '#B8B5D1',
};

const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const fontSize = text.length > 40 ? 64 : text.length > 24 ? 76 : 88;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 70px' }}>
      <div
        style={{
          transform: `scale(${0.9 + pop * 0.1}) translateY(${(1 - pop) * 30}px)`,
          opacity: pop,
          background: 'rgba(0, 0, 0, 0.55)',
          border: `6px solid ${COLOR.yellow}`,
          borderRadius: 36,
          padding: '44px 52px',
          maxWidth: 940,
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontSize,
            fontWeight: 900,
            lineHeight: 1.4,
            color: COLOR.white,
            // 句読点や「？」が行頭に来ないよう禁則を厳格にする。台本側で \n を入れれば任意の位置で改行できる
            lineBreak: 'strict',
            whiteSpace: 'pre-line',
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const ShortVideo: React.FC<ShortVideoProps> = ({ title, brandName, handle, lines }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 100], { extrapolateRight: 'clamp' });

  // 各行の開始フレーム = それより前の行の尺の合計
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((acc, l) => acc + l.durationInFrames, 0));
  const sequences = lines.map((line, i) => (
    <Sequence key={i} from={starts[i]} durationInFrames={line.durationInFrames}>
      <Audio src={staticFile(line.audioSrc)} />
      <Caption text={line.caption} />
    </Sequence>
  ));

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.bg, fontFamily: FONT }}>
      {/* 背景: ブランドの黄色を斜めの帯で敷き、アイコンの「急上昇矢印」を連想させる */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${COLOR.bg} 0%, ${COLOR.bg} 55%, #2A2640 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 2400,
          height: 220,
          left: -600,
          top: 1500,
          background: `linear-gradient(90deg, ${COLOR.orange}, ${COLOR.yellow})`,
          opacity: 0.18,
          transform: 'rotate(-35deg)',
        }}
      />

      {/* 上部: ブランドとタイトル（YouTube Shorts の下部 UI と被らないよう上側に置く） */}
      <div style={{ position: 'absolute', top: 120, left: 70, right: 70 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Img src={staticFile('brand/icon-512.png')} style={{ width: 96, height: 96, borderRadius: '50%' }} />
          <span style={{ color: COLOR.yellow, fontSize: 44, fontWeight: 900 }}>{brandName}</span>
        </div>
        <div
          style={{
            marginTop: 36,
            color: COLOR.white,
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.35,
            borderLeft: `10px solid ${COLOR.red}`,
            paddingLeft: 24,
          }}
        >
          {title}
        </div>
      </div>

      {sequences}

      {/* 下部: ハンドル */}
      <div
        style={{
          position: 'absolute',
          bottom: 330,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: COLOR.muted,
          fontSize: 34,
          fontWeight: 700,
        }}
      >
        {handle}
      </div>

      {/* 最下部: 進捗バー */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 14, background: 'rgba(255,255,255,0.15)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: COLOR.yellow }} />
      </div>
    </AbsoluteFill>
  );
};
