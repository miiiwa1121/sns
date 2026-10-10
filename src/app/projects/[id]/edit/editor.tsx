'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ArrowLeft, Clapperboard, Film, RefreshCw, Save, Square } from 'lucide-react';
import type { ScriptLine } from '@/lib/script';
import type { ActionState } from '@/app/actions';
import { ResizableColumns } from '@/app/components/workspace';
import { ScriptPlayer } from '@/app/components/script-preview';
import { LinesEditor } from './lines';

type Props = {
  projectId: string;
  initialTitle: string;
  initialLines: ScriptLine[];
  brandName: string;
  handle: string;
  videoUrl: string | null; // 今の動画（作り直す前のもの）
  posterUrl: string | null;
  outdated: boolean; // 保存済みの台本が、今の動画を作ったときの台本と違う
  rendering: boolean;
  renderProgress: string | null;
  renderError: string | null;
  chatBusy: boolean;
  blockedReason: string | null; // 直せない理由（投稿済みなど）
  chat: React.ReactNode;
  save: (title: string, lines: ScriptLine[]) => Promise<ActionState>;
  render: () => Promise<ActionState>;
  stop: () => Promise<ActionState>;
};

// 動画編集画面。ヘッダー: 戻る・タイトル・保存・作り直す／停止 / 左: 台本 / 中央: プレビュー（音声なし）と作った動画 / 右: AI への依頼
// 作り直し中・AI の作業中・投稿済みは、台本を直せない（画面を読み直したときに、入力中の内容が消えないように）
export function VideoEditor(p: Props) {
  const [title, setTitle] = useState(p.initialTitle);
  const [lines, setLines] = useState(p.initialLines);
  const [result, setResult] = useState<ActionState>(null);
  const [tab, setTab] = useState<'preview' | 'video'>('preview');
  const [pending, startTransition] = useTransition();
  const dirty = title !== p.initialTitle || JSON.stringify(lines) !== JSON.stringify(p.initialLines);
  const busy = p.rendering || p.chatBusy;
  const locked = busy || p.blockedReason !== null;

  // 結果のメッセージは数秒で消す
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.ok ? 3000 : 6000);
    return () => clearTimeout(t);
  }, [result]);

  // 保存していない変更があるまま画面を離れようとしたら確かめる
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const run = (fn: () => Promise<ActionState>) => startTransition(async () => setResult(await fn()));
  const save = () => run(() => p.save(title, lines));
  const saveAndRender = () =>
    run(async () => {
      if (dirty) {
        const saved = await p.save(title, lines);
        if (!saved?.ok) return saved;
      }
      return p.render();
    });

  return (
    <div className="page full-page">
      <header className="ws-header">
        <Link href={`/projects/${p.projectId}`} className="btn" title="企画に戻る">
          <ArrowLeft size={14} />
          戻る
        </Link>
        <div className="ws-title">
          <input className="ws-name" value={title} maxLength={60} aria-label="動画のタイトル" title="動画の上部に出るタイトル" disabled={locked} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="ws-actions">
          {result && <span className={`notice ${result.ok ? 'ok' : 'ng'}`}>{result.message}</span>}
          {dirty && <span className="badge you">保存していない変更があります</span>}
          {!dirty && p.outdated && !p.rendering && <span className="badge">動画は直す前のままです</span>}
          {!busy && (
            <button className="btn" disabled={!dirty || locked || pending} onClick={save}>
              <Save size={14} />
              保存
            </button>
          )}
          {busy ? (
            <button className="btn danger" disabled={pending} onClick={() => run(p.stop)}>
              <Square size={12} fill="currentColor" />
              停止
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={p.blockedReason !== null || pending}
              onClick={() => {
                if (window.confirm('この台本で、音声と動画を作り直します（数分かかります）。作り直すと承認はやり直しになります。よろしいですか？')) saveAndRender();
              }}
            >
              <RefreshCw size={14} />
              {dirty ? '保存して作り直す' : '動画を作り直す'}
            </button>
          )}
        </div>
      </header>

      {p.blockedReason && <p className="notice ng">{p.blockedReason}</p>}
      {p.rendering && <p className="notice ok">作り直しています… {p.renderProgress ?? ''}</p>}
      {!p.rendering && p.renderError && <p className="notice ng">{p.renderError}</p>}

      <ResizableColumns
        storageKey="editor-columns"
        left={
          <section className="card ws-fill-card">
            <div className="ws-scroll">
              <LinesEditor lines={lines} disabled={locked} onChange={setLines} />
            </div>
          </section>
        }
        center={
          <section className="card ws-fill-card">
            <div className="ws-preview-bar">
              <div className="seg" role="tablist" aria-label="表示の切り替え">
                <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>
                  <Film size={16} />
                  <span>プレビュー（音声なし）</span>
                </button>
                <button type="button" role="tab" aria-selected={tab === 'video'} className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>
                  <Clapperboard size={16} />
                  <span>作った動画</span>
                </button>
              </div>
            </div>
            {tab === 'preview' ? (
              <ScriptPlayer title={title} lines={lines} brandName={p.brandName} handle={p.handle} />
            ) : p.videoUrl ? (
              <div className="ws-media">
                <div className="ws-player">
                  <video src={p.videoUrl} poster={p.posterUrl ?? undefined} controls preload="metadata" style={{ height: '100%', maxWidth: '100%', aspectRatio: '9 / 16' }} />
                </div>
                {p.outdated && <p className="muted">この動画は、台本を直す前のものです。「動画を作り直す」で今の台本に合わせます。</p>}
              </div>
            ) : (
              <div className="empty">まだ動画はありません。</div>
            )}
          </section>
        }
        right={
          <section className="card ws-fill-card">
            {/* AI が直すと台本が書き換わるため、保存していない手直しがある間は頼めない */}
            {dirty && <p className="notice ng">保存してから AI に頼んでください（保存していない手直しが消えないように）</p>}
            <div className="ws-chat-wrap" inert={dirty}>{p.chat}</div>
          </section>
        }
      />
    </div>
  );
}
