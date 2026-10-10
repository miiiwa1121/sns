'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { ArrowLeft, Film, Play, Save, Text, Trash2 } from 'lucide-react';
import { ShortVideo, TAIL_FRAMES } from '../../../../../remotion/ShortVideo';
import { toPreviewLines, type ScriptLine } from '@/lib/script';
import type { ActionState } from '@/app/actions';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Notice({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>;
}

// 試作の話題を選ぶフォーム（左の列）。送信ボタンはヘッダーの「試作する」（form 属性でこのフォームを送る）
export const SAMPLE_FORM_ID = 'workshop-sample-form';

// ---------- ヘッダー ----------

// 押すだけの操作（保存・削除）。結果はヘッダーの中に小さく出す
function HeaderButton({
  action,
  label,
  pendingLabel,
  icon,
  className = '',
  confirm,
  onResult,
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  icon: React.ReactNode;
  className?: string;
  confirm?: string;
  onResult: (state: ActionState) => void;
}) {
  const [, run, pending] = useActionState<ActionState>(async () => {
    const result = await action();
    onResult(result);
    return result;
  }, null);
  return (
    <form action={run} onSubmit={(e) => confirm && !window.confirm(confirm) && e.preventDefault()}>
      <button className={`btn ${className}`} disabled={pending}>
        {icon}
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

export function WorkshopHeader({
  name,
  busy,
  baseTemplateName,
  savedTemplateId,
  saveOverwrite,
  saveNew,
  remove,
}: {
  name: string;
  busy: boolean;
  baseTemplateName: string | null;
  savedTemplateId: string | null;
  saveOverwrite: (() => Promise<ActionState>) | null;
  saveNew: () => Promise<ActionState>;
  remove: () => Promise<ActionState>;
}) {
  const [result, setResult] = useState<ActionState>(null);
  return (
    <header className="ws-header">
      <Link href="/templates" className="btn" aria-label="構成案一覧に戻る" title="構成案一覧に戻る">
        <ArrowLeft size={16} />
        戻る
      </Link>
      <div className="ws-title">
        <h1>{name}</h1>
        <span className="muted">
          {baseTemplateName ? `元にした構成案: ${baseTemplateName}` : '新しい構成案'}
          {savedTemplateId && <> ・ <Link href={`/templates/${savedTemplateId}`}>保存した構成案を開く</Link></>}
        </span>
      </div>
      <div className="ws-actions">
        {result && <span className={`notice ${result.ok ? 'ok' : 'ng'}`}>{result.message}</span>}
        {busy && <span className="badge you">AI が作業中…</span>}
        <button className="btn primary" form={SAMPLE_FORM_ID} disabled={busy}>
          <Play size={16} />
          試作する
        </button>
        {saveOverwrite && baseTemplateName && (
          <HeaderButton
            action={saveOverwrite}
            label="上書き保存"
            pendingLabel="保存中…"
            icon={<Save size={16} />}
            confirm={`「${baseTemplateName}」をこの下書きで上書きします。この構成案を既定にしているアカウントの、これからの依頼に影響します。よろしいですか？`}
            onResult={setResult}
          />
        )}
        <HeaderButton
          action={saveNew}
          label={saveOverwrite ? '新規保存' : '構成案として保存'}
          pendingLabel="保存中…"
          icon={<Save size={16} />}
          onResult={setResult}
        />
        <HeaderButton
          action={remove}
          label="削除"
          pendingLabel="削除中…"
          icon={<Trash2 size={16} />}
          className="danger"
          confirm="この相談（会話と試作）を削除します。保存した構成案は残ります。よろしいですか？"
          onResult={setResult}
        />
      </div>
    </header>
  );
}

// ---------- 左の列: 試作の話題・下書き ----------

export function SampleTopicForm({ action, topics }: { action: Action; topics: string[] }) {
  const [state, run] = useActionState(action, null);
  return (
    <form id={SAMPLE_FORM_ID} action={run} className="stack" style={{ gap: 8 }}>
      {topics.length > 0 && (
        <select name="topic" className="input" defaultValue={topics[0]} aria-label="リサーチの話題">
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      <input name="topicText" className="input" placeholder={topics.length > 0 ? 'または話題を自由に入力（入力した方を使います）' : '試作の話題を入力'} />
      <span className="muted">ヘッダーの「試作する」で、この話題と今の下書きで台本を1本書きます（30秒ほど）。リサーチの話題はその要約の範囲で書き、自由入力は Web で調べません。</span>
      <Notice state={state} />
    </form>
  );
}

// 下書きの編集（名前・説明・構成の指示）。AI が構成案を直したら、key が変わって作り直される
export function DraftForm({ action, values }: { action: Action; values: { name: string; description: string | null; body: string } }) {
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
        <textarea id="body" name="body" className="input" rows={14} maxLength={4000} defaultValue={values.body} />
      </div>
      <div className="row between">
        <span className="muted">手で直したら保存してから相談・試作してください</span>
        <button className="btn" disabled={pending}>{pending ? '保存中…' : '下書きを保存'}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

// ---------- 中央の列: 試作のプレビュー（動画・画像 / テキスト） ----------

type SampleTab = { id: string; label: string; href: string; active: boolean };

export function SamplePreview({
  title,
  lines,
  topic,
  brandName,
  handle,
  samples,
}: {
  title: string;
  lines: ScriptLine[];
  topic: string | null;
  brandName: string;
  handle: string;
  samples: SampleTab[];
}) {
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const previewLines = toPreviewLines(lines);
  const durationInFrames = Math.max(30, previewLines.reduce((acc, l) => acc + l.durationInFrames, 0) + TAIL_FRAMES);
  const inputProps = { title, brandName, handle, lines: previewLines, bgmSrc: null, credit: null };
  // 各行の 60% 地点のコマ（確認用静止画と同じ位置）
  const starts = previewLines.map((_, i) => previewLines.slice(0, i).reduce((acc, l) => acc + l.durationInFrames, 0));
  const stillFrames = previewLines.map((l, i) => starts[i] + Math.floor(l.durationInFrames * 0.6));
  const playerKey = `${title}-${lines.length}-${durationInFrames}`;

  return (
    <div className="ws-preview">
      <div className="ws-preview-bar">
        <div className="seg" role="tablist" aria-label="表示の切り替え">
          <button type="button" role="tab" aria-selected={mode === 'media'} className={mode === 'media' ? 'active' : ''} onClick={() => setMode('media')}>
            <Film size={16} />
            <span>動画・画像</span>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>
            <Text size={16} />
            <span>テキスト</span>
          </button>
        </div>
        {samples.length > 1 && (
          <nav className="ws-samples" aria-label="試作の切り替え">
            {samples.map((s) => (
              <Link key={s.id} href={s.href} className={s.active ? 'active' : ''} scroll={false}>{s.label}</Link>
            ))}
          </nav>
        )}
      </div>

      {mode === 'media' ? (
        <div className="stack" style={{ gap: 16 }}>
          <div className="ws-player">
            <Player
              key={playerKey}
              component={ShortVideo}
              inputProps={inputProps}
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
          </div>
          <div className="ws-stills">
            {stillFrames.map((frame, i) => (
              <figure key={`${playerKey}-${i}`}>
                <Thumbnail
                  component={ShortVideo}
                  inputProps={inputProps}
                  frameToDisplay={frame}
                  durationInFrames={durationInFrames}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  fps={30}
                  style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 8, overflow: 'hidden' }}
                />
                <figcaption className="muted">{i + 1}</figcaption>
              </figure>
            ))}
          </div>
          <p className="muted">音声なし。各行の長さは文字数からの見積もりです（実際の動画では音声の長さで決まります）。</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{title}</strong>
            {topic && <span className="muted">話題: {topic}</span>}
          </div>
          <table className="sheet">
            <thead>
              <tr><th>#</th><th>場面</th><th>表情</th><th>字幕</th><th>読み上げ</th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td>{l.scene?.type ?? <span className="muted">（継続）</span>}</td>
                  <td>{l.mood ?? <span className="muted">（継続）</span>}</td>
                  <td className="wrap" style={{ whiteSpace: 'pre-line' }}>{l.caption ?? l.text}</td>
                  <td className="wrap">{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- 右の列: 相談の入力欄 ----------

// 送ったら空にする。Enter で改行、Ctrl/⌘ + Enter で送信
export function ChatForm({ action, disabled }: { action: Action; disabled: boolean }) {
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
