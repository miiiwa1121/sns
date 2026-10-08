import React from 'react';
import { Composition } from 'remotion';
import { ShortVideo, ShortVideoProps } from './ShortVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortClip1"
        component={ShortVideo as any}
        durationInFrames={840} // 28 seconds @ 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: '【警告】チャットAIの時代は終了しました',
          hookSentence: '「まだチャットAIに質問して返答待ってるの？それ時代遅れです！」',
          creatorHandle: '@ai_pulse_lab',
        }}
      />
    </>
  );
};
