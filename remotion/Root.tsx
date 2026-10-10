import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import { ShortVideo, TAIL_FRAMES } from './ShortVideo';
import { ShortVideoProps } from './types';

const FPS = 30;

// 尺は字幕行（= 音声）の合計から決める
const calculateMetadata: CalculateMetadataFunction<ShortVideoProps> = ({ props }) => ({
  durationInFrames: Math.max(FPS, props.lines.reduce((acc, l) => acc + l.durationInFrames, 0) + TAIL_FRAMES),
});

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Short"
      component={ShortVideo}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS}
      calculateMetadata={calculateMetadata}
      // Remotion Studio でのレイアウト確認用（音声なし）。実際の値は agent/cli.ts produce が --props で渡す
      defaultProps={{
        title: 'タイトル',
        brandName: 'ついていくのが精一杯',
        handle: '@tuiteikunogaseiippai',
        lines: [],
        bgmSrc: null,
        credit: null,
      }}
    />
  );
};
