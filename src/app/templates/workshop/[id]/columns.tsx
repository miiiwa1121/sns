'use client';

import { useEffect, useRef } from 'react';

// 幅を変えられる3列（左・中央・右）。左右の列の幅を境目のドラッグで変え、このブラウザに覚えておく（ダブルクリックで元に戻す）。
// 幅は CSS 変数（--ws-left / --ws-right）に直接書く（ドラッグ中に React の再描画を起こさないため）。
// 狭い画面では縦に積む（境目は出さない）
const STORAGE_KEY = 'workshop-columns';
const DEFAULT = { left: 340, right: 400 };
const MIN = 240;
const CENTER_MIN = 320;
const HANDLE = 8;

type Widths = typeof DEFAULT;

export function ResizableColumns({ left, center, right }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const widths = useRef<Widths>(DEFAULT);

  const apply = (next: Widths) => {
    widths.current = next;
    container.current?.style.setProperty('--ws-left', `${next.left}px`);
    container.current?.style.setProperty('--ws-right', `${next.right}px`);
  };

  const save = (next: Widths) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 保存できない環境（プライベートブラウズ等）でも幅の変更自体は効く
    }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && typeof saved.left === 'number' && typeof saved.right === 'number') apply(saved);
    } catch {
      // 読めなければ既定の幅のまま
    }
  }, []);

  const startDrag = (side: 'left' | 'right') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const total = container.current?.getBoundingClientRect().width ?? 0;
    const startX = e.clientX;
    const start = widths.current;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const other = side === 'left' ? start.right : start.left;
      // 中央の列が狭くなりすぎないように、片側の上限を決める
      const max = Math.max(MIN, total - other - CENTER_MIN - HANDLE * 2);
      const value = Math.min(max, Math.max(MIN, side === 'left' ? start.left + dx : start.right - dx));
      apply({ ...start, [side]: value });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('resizing');
      save(widths.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.classList.add('resizing');
  };

  const reset = () => {
    apply(DEFAULT);
    save(DEFAULT);
  };

  const handle = (side: 'left' | 'right') => (
    <div
      className="ws-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? '左の列の幅を変える' : '右の列の幅を変える'}
      title="ドラッグで幅を変更（ダブルクリックで元に戻す）"
      onPointerDown={startDrag(side)}
      onDoubleClick={reset}
    />
  );

  return (
    <div ref={container} className="ws-cols" style={{ '--ws-left': `${DEFAULT.left}px`, '--ws-right': `${DEFAULT.right}px` } as React.CSSProperties}>
      <div className="ws-col">{left}</div>
      {handle('left')}
      <div className="ws-col">{center}</div>
      {handle('right')}
      <div className="ws-col ws-chat">{right}</div>
    </div>
  );
}

// 相談の発言一覧。開いたときと発言が増えたとき（AI の返事が届いたときを含む）に、いちばん下までスクロールする
export function ChatScroll({ count, children }: { count: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [count]);
  return <div ref={box} className="chat">{children}</div>;
}
