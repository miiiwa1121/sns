import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  staticFile,
} from 'remotion';

export interface ShortVideoProps {
  title: string;
  hookSentence: string;
  creatorHandle: string;
}

export const ShortVideo: React.FC<ShortVideoProps> = ({
  title,
  hookSentence,
  creatorHandle,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // 1. プログレスバーの進捗 (0% -> 100%)
  const progressPercent = (frame / durationInFrames) * 100;

  // 2. 背景オーブのパルスアニメーション
  const pulseScale = interpolate(
    Math.sin((frame / fps) * Math.PI * 1.5),
    [-1, 1],
    [0.85, 1.15]
  );

  // 3. タイムラインに応じた字幕（テロップ）の切り替え
  // 全長: 28秒 (840フレーム)
  let currentCaption = hookSentence;
  let captionHighlight = '#facc15'; // 蛍光イエロー

  if (frame > fps * 6 && frame <= fps * 13) {
    currentCaption = '2026年の最新AIエージェントなら、ゴールを1行伝えるだけで勝手に業務を完了！';
    captionHighlight = '#38bdf8'; // ネオンシアン
  } else if (frame > fps * 13 && frame <= fps * 21) {
    currentCaption = 'ブラウザ操作・競合リサーチ・資料作成まで全自動。もうコピペする時代は終了。';
    captionHighlight = '#a855f7'; // ネオンパープル
  } else if (frame > fps * 21) {
    currentCaption = '今すぐ使える神ツールの詳細はプロフィールのリンクをチェック📌';
    captionHighlight = '#4ade80'; // エメラルドグリーン
  }

  // テロップのバウンススプリング
  const captionSpring = spring({
    frame: frame % (fps * 7),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  return (
    <div
      style={{
        flex: 1,
        width,
        height,
        backgroundColor: '#07090e',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 実際の合成音声 (ナレーション) */}
      <Audio src={staticFile('audio/short1_narration.mp3')} />

      {/* --- 背景演出: 動的ネオンオーブ & グリッド --- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 35%, #1e1b4b 0%, #07090e 75%)',
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '20%',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, transparent 70%)',
            filter: 'blur(70px)',
            transform: `scale(${pulseScale})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '15%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, transparent 70%)',
            filter: 'blur(80px)',
            transform: `scale(${1.2 - (pulseScale - 1)})`,
          }}
        />
      </div>

      {/* --- 上部ヘッダーバッジ --- */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '80px 60px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            padding: '16px 36px',
            borderRadius: '40px',
            color: '#ffffff',
            fontSize: '32px',
            fontWeight: 800,
            boxShadow: '0 10px 30px rgba(99, 102, 241, 0.5)',
            letterSpacing: '0.04em',
          }}
        >
          ⚡️ 2026 最新AI速報
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            padding: '12px 28px',
            borderRadius: '30px',
            color: '#38bdf8',
            fontSize: '28px',
            fontWeight: 700,
          }}
        >
          OmniPulse AI
        </div>
      </div>

      {/* --- 中央: 動くバウンス字幕 (メインテロップ) --- */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '0 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {/* 動画タイトルピル */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            padding: '14px 32px',
            borderRadius: '24px',
            color: '#cbd5e1',
            fontSize: '30px',
            fontWeight: 700,
            marginBottom: '36px',
          }}
        >
          {title}
        </div>

        {/* メインテロップボックス */}
        <div
          style={{
            background: 'rgba(7, 9, 14, 0.92)',
            border: `5px solid ${captionHighlight}`,
            borderRadius: '36px',
            padding: '48px 56px',
            boxShadow: `0 20px 60px rgba(0, 0, 0, 0.9), 0 0 40px ${captionHighlight}44`,
            transform: `scale(${0.96 + captionSpring * 0.06})`,
            maxWidth: '920px',
          }}
        >
          <span
            style={{
              fontSize: '56px',
              fontWeight: 900,
              color: captionHighlight,
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              textShadow: '0 4px 20px rgba(0,0,0,0.8)',
            }}
          >
            {currentCaption}
          </span>
        </div>
      </div>

      {/* --- 下部: クリエイター情報 & SNSオーバーレイ --- */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '0 60px 80px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {/* 左側: アカウント情報 */}
        <div style={{ maxWidth: '650px' }}>
          <div
            style={{
              fontSize: '40px',
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: '14px',
              letterSpacing: '-0.01em',
            }}
          >
            {creatorHandle}
          </div>
          <div
            style={{
              fontSize: '32px',
              color: '#94a3b8',
              lineHeight: 1.4,
              marginBottom: '20px',
            }}
          >
            #AIエージェント #自動化 #仕事効率化 #最新トレンド
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.12)',
              padding: '10px 24px',
              borderRadius: '20px',
              fontSize: '26px',
              color: '#e2e8f0',
            }}
          >
            🎵 Cyberpunk Lo-Fi Beat #04
          </div>
        </div>

        {/* 右側: ソーシャルアクションモック */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '40px',
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
              }}
            >
              ❤️
            </div>
            <span style={{ fontSize: '24px', color: '#ffffff', fontWeight: 700, marginTop: '8px', display: 'block' }}>
              48.2K
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
              }}
            >
              💬
            </div>
            <span style={{ fontSize: '24px', color: '#ffffff', fontWeight: 700, marginTop: '8px', display: 'block' }}>
              892
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
              }}
            >
              ↗️
            </div>
            <span style={{ fontSize: '24px', color: '#ffffff', fontWeight: 700, marginTop: '8px', display: 'block' }}>
              シェア
            </span>
          </div>
        </div>
      </div>

      {/* --- 最下部: リアルタイムプログレスバー --- */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '14px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          zIndex: 20,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #6366f1, #38bdf8)',
          }}
        />
      </div>
    </div>
  );
};
