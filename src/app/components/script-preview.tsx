'use client';

import { Player, Thumbnail } from '@remotion/player';
import { ShortVideo, TAIL_FRAMES } from '../../../remotion/ShortVideo';
import { toPreviewLines, type ScriptLine } from '@/lib/script';

// 台本を、その場で映像として見せる（ブラウザ上の Remotion Player。音声なし、各行の長さは文字数からの見積もり）。
// 下に各行のコマ一覧（各行の 60% 地点。確認用静止画と同じ位置）を並べる。構成案の相談と動画編集で使う
export function ScriptPlayer({ title, lines, brandName, handle }: { title: string; lines: ScriptLine[]; brandName: string; handle: string }) {
  const previewLines = toPreviewLines(lines);
  const durationInFrames = Math.max(30, previewLines.reduce((acc, l) => acc + l.durationInFrames, 0) + TAIL_FRAMES);
  const inputProps = { title, brandName, handle, lines: previewLines, bgmSrc: null, credit: null };
  const starts = previewLines.map((_, i) => previewLines.slice(0, i).reduce((acc, l) => acc + l.durationInFrames, 0));
  const stillFrames = previewLines.map((l, i) => starts[i] + Math.floor(l.durationInFrames * 0.6));
  const composition = { component: ShortVideo, inputProps, durationInFrames, compositionWidth: 1080, compositionHeight: 1920, fps: 30 };
  // 台本の長さが変わったら作り直す（再生位置が範囲外にならないように）
  const playerKey = `${lines.length}-${durationInFrames}`;

  return (
    <div className="ws-media">
      <div className="ws-player">
        <Player
          key={playerKey}
          {...composition}
          controls
          loop
          // 0 フレーム目は場面の入りのアニメーション前で何も見えないため、少し進めた位置で止めておく
          initialFrame={Math.min(20, durationInFrames - 1)}
          style={{ height: '100%', maxWidth: '100%', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden' }}
          errorFallback={({ error }) => (
            <div style={{ padding: 24, color: '#b91c1c', fontSize: 28 }}>表示できませんでした（場面の項目が足りない可能性）: {error.message}</div>
          )}
        />
      </div>
      <div className="ws-stills" aria-label="各行のコマ">
        {stillFrames.map((frame, i) => (
          <figure key={i}>
            <Thumbnail {...composition} frameToDisplay={frame} style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 6, overflow: 'hidden' }} />
            <figcaption className="muted">{i + 1}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
