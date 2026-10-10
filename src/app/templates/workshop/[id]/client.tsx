'use client';

import { useActionState, useRef } from 'react';
import { Player } from '@remotion/player';
import { ShortVideo, TAIL_FRAMES } from '../../../../../remotion/ShortVideo';
import { toPreviewLines, type ScriptLine } from '@/lib/script';
import type { ActionState } from '@/app/actions';

function Notice({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>;
}

// 相談の入力欄。送ったら空にする。Enter で改行、Ctrl/⌘ + Enter で送信
export function ChatForm({ action, disabled }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; disabled: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={run} className="stack" style={{ gap: 8 }}>
      <textarea
        name="text"
        className="input"
        rows={3}
        placeholder="例: 冒頭2行で結論を言い切る型にしたい / 試作の5行目が長いので行数を減らして"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="row between">
        <span className="muted">Ctrl / ⌘ + Enter で送信</span>
        <button className="btn primary" disabled={pending || disabled}>{pending ? '送信中…' : '相談する'}</button>
      </div>
      {state && !state.ok && <Notice state={state} />}
    </form>
  );
}

// 試作の依頼。話題はアカウントのリサーチから選ぶか、自由に入力する
export function SampleForm({
  action,
  topics,
  disabled,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  topics: string[];
  disabled: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="stack" style={{ gap: 8 }}>
      {topics.length > 0 && (
        <select name="topic" className="input" defaultValue={topics[0]}>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      <input name="topicText" className="input" placeholder={topics.length > 0 ? 'または話題を自由に入力（入力した方を使います）' : '試作の話題を入力'} />
      <div className="row between">
        <span className="muted">リサーチの話題は、その要約の範囲で書きます。自由入力は Web で調べません</span>
        <button className="btn" disabled={pending || disabled}>{pending ? '依頼中…' : '試作する'}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

// 下書きの編集（名前・説明・構成の指示）。AI が構成案を直したら、key が変わって作り直される
export function DraftForm({
  action,
  values,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values: { name: string; description: string | null; body: string };
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="stack" style={{ gap: 10 }}>
      <div className="field">
        <label htmlFor="name">名前</label>
        <input id="name" name="name" className="input" maxLength={60} defaultValue={values.name} />
      </div>
      <div className="field">
        <label htmlFor="description">説明（任意）</label>
        <input id="description" name="description" className="input" maxLength={200} defaultValue={values.description ?? ''} />
      </div>
      <div className="field">
        <label htmlFor="body">構成の指示</label>
        <textarea id="body" name="body" className="input" rows={12} maxLength={4000} defaultValue={values.body} />
      </div>
      <div className="row between">
        <span className="muted">手で直したら保存してから相談・試作してください</span>
        <button className="btn" disabled={pending}>{pending ? '保存中…' : '下書きを保存'}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

// 試作の映像プレビュー（音声なし。各行の長さは文字数からの見積もり）
export function SamplePlayer({ title, lines, brandName, handle }: { title: string; lines: ScriptLine[]; brandName: string; handle: string }) {
  const previewLines = toPreviewLines(lines);
  const durationInFrames = Math.max(30, previewLines.reduce((acc, l) => acc + l.durationInFrames, 0) + TAIL_FRAMES);
  // 試作を切り替えたら作り直して頭から再生する
  const key = `${title}-${lines.length}-${durationInFrames}`;
  return (
    <Player
      key={key}
      component={ShortVideo}
      inputProps={{ title, brandName, handle, lines: previewLines, bgmSrc: null, credit: null }}
      durationInFrames={durationInFrames}
      compositionWidth={1080}
      compositionHeight={1920}
      fps={30}
      controls
      loop
      // 0 フレーム目は場面の入りのアニメーション前で何も見えないため、少し進めた位置で止めておく
      initialFrame={20}
      style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden' }}
      errorFallback={({ error }) => (
        <div style={{ padding: 24, color: '#b91c1c', fontSize: 28 }}>この試作は表示できませんでした（場面の項目が足りない可能性）: {error.message}</div>
      )}
    />
  );
}
