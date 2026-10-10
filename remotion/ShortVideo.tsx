import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { COLOR, FONT, SHADOW, fitFontSize } from './theme';
import { Mood, Scene, ShortVideoLine, ShortVideoProps } from './types';
import { Caption } from './components/Caption';
import { Mascot } from './components/Mascot';
import { SceneView, STAGE_H, STAGE_W } from './components/Scenes';

export type { ShortVideoProps } from './types';

// 末尾に無音の余白を足し、最後の字幕が途切れて見えないようにする
export const TAIL_FRAMES = 20;

// レイアウト（1080×1920）。YouTube Shorts の下部 UI（タイトル・チャンネル名）と右側のボタンに重ならない範囲に収める
const STAGE_X = 50;
const STAGE_Y = 290;
const CAPTION_Y = 1120;
const CAPTION_H = 300;
const MASCOT_SIZE = 230;
const MASCOT_X = 20;
const MASCOT_Y = STAGE_Y + STAGE_H - 170;

const SE = { pop: 'se/pop.wav', whoosh: 'se/whoosh.wav' };

// 場面は、scene を持つ行から次に scene を持つ行の手前までの区間（セグメント）で1つ描く。途中でアニメーションが切れないようにするため
function buildSegments(lines: ShortVideoLine[], title: string) {
  const segments: { scene: Scene; from: number; duration: number }[] = [];
  let from = 0;
  lines.forEach((line, i) => {
    if (line.scene || i === 0) {
      segments.push({ scene: line.scene ?? { type: 'keyword', text: title }, from, duration: 0 });
    }
    segments[segments.length - 1].duration += line.durationInFrames;
    from += line.durationInFrames;
  });
  return segments;
}

// 背景: 白に近い水色の無地に、上部だけごく薄いグラデーション（シンプルさ優先で模様は入れない）
const Background: React.FC = () => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLOR.primarySoft} 0%, ${COLOR.bg} 35%, ${COLOR.bg} 100%)` }} />
);

// 1行分のマスコット。音声の大きさから口の開きを決める
const LineMascot: React.FC<{ audioSrc: string; mood: Mood; globalFrom: number }> = ({ audioSrc, mood, globalFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(audioSrc));
  let mouth = 0;
  if (audioData) {
    const spectrum = visualizeAudio({ fps, frame, audioData, numberOfSamples: 16 });
    mouth = Math.min(1, Math.max(...spectrum.slice(0, 6)) * 3);
  }
  return <Mascot mood={mood} mouth={mouth} frame={globalFrom + frame} enterFrame={frame} size={MASCOT_SIZE} />;
};

// 場面の入り: 下からスライド + フェード
const SceneTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: t, transform: `translateY(${(1 - t) * 60}px)` }}>{children}</div>
  );
};

export const ShortVideo: React.FC<ShortVideoProps> = ({ title, brandName, handle, lines, bgmSrc, credit }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 100], { extrapolateRight: 'clamp' });

  const starts = lines.map((_, i) => lines.slice(0, i).reduce((acc, l) => acc + l.durationInFrames, 0));
  const segments = buildSegments(lines, title);
  // マスコットの表情は、指定が無い行では直前の行を引き継ぐ
  const moods = lines.reduce<Mood[]>((acc, l, i) => [...acc, l.mood ?? (i > 0 ? acc[i - 1] : 'nod')], []);
  const outroFrom = segments.find((s) => s.scene.type === 'outro')?.from ?? Infinity;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.bg, fontFamily: FONT }}>
      <Background />

      {bgmSrc && <Audio src={staticFile(bgmSrc)} volume={0.1} loop />}

      {/* ヘッダー: ブランドとタイトル */}
      <div style={{ position: 'absolute', top: 90, left: 60, right: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Img src={staticFile('brand/icon-512.png')} style={{ width: 80, height: 80, borderRadius: '50%' }} />
          <span style={{ color: COLOR.text, fontSize: 40, fontWeight: 900 }}>{brandName}</span>
        </div>
        <div
          style={{
            marginTop: 22,
            color: COLOR.sub,
            fontSize: fitFontSize(title, 900, 30, 46),
            fontWeight: 800,
            borderLeft: `8px solid ${COLOR.primary}`,
            paddingLeft: 20,
            whiteSpace: 'pre-line',
          }}
        >
          {title}
        </div>
      </div>

      {/* ステージ: 場面ごとのアニメーション */}
      <div
        style={{
          position: 'absolute',
          left: STAGE_X,
          top: STAGE_Y,
          width: STAGE_W,
          height: STAGE_H,
          borderRadius: 40,
          background: COLOR.surface,
          border: `3px solid ${COLOR.border}`,
          overflow: 'hidden',
          boxShadow: SHADOW,
        }}
      >
        {segments.map((seg, i) => (
          <Sequence key={i} from={seg.from} durationInFrames={seg.duration} layout="none">
            <SceneTransition>
              <SceneView scene={seg.scene} brandName={brandName} />
            </SceneTransition>
          </Sequence>
        ))}
      </div>

      {/* 行ごと: 音声・効果音・字幕・マスコット */}
      {lines.map((line, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={line.durationInFrames} layout="none">
          <Audio src={staticFile(line.audioSrc)} />
          {i > 0 && <Audio src={staticFile(line.scene ? SE.whoosh : SE.pop)} volume={line.scene ? 0.35 : 0.25} />}
          <div style={{ position: 'absolute', left: 0, right: 0, top: CAPTION_Y, height: CAPTION_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Caption text={line.caption} emphasis={line.emphasis} />
          </div>
          {starts[i] < outroFrom && (
            <div style={{ position: 'absolute', left: MASCOT_X, top: MASCOT_Y }}>
              <LineMascot audioSrc={line.audioSrc} mood={moods[i]} globalFrom={starts[i]} />
            </div>
          )}
        </Sequence>
      ))}

      {/* ハンドルとクレジット */}
      <div style={{ position: 'absolute', top: CAPTION_Y + CAPTION_H + 10, left: 0, right: 0, textAlign: 'center', color: COLOR.muted, fontSize: 28, fontWeight: 700 }}>
        {handle}
        {credit && <span style={{ marginLeft: 24, fontSize: 24, opacity: 0.8 }}>{credit}</span>}
      </div>

      {/* 進捗バー */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 14, background: COLOR.border }}>
        <div style={{ height: '100%', width: `${progress}%`, background: COLOR.primary }} />
      </div>
    </AbsoluteFill>
  );
};
