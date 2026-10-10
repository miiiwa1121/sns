'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { ArrowLeft, Film, Play, Save, Send, Square, Text, Trash2 } from 'lucide-react';
import { ShortVideo, TAIL_FRAMES } from '../../../../../remotion/ShortVideo';
import { toPreviewLines, type ScriptLine } from '@/lib/script';
import type { ActionState } from '@/app/actions';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// ---------- ヘッダー ----------

// 押すだけの操作（試作・停止・保存・削除）。結果はヘッダーの中に小さく出す
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

// 構成案の名前。ヘッダーでそのまま直せる（Enter か、欄から離れたときに保存）
function NameInput({ name, rename, onResult }: { name: string; rename: (name: string) => Promise<ActionState>; onResult: (s: ActionState) => void }) {
  const [value, setValue] = useState(name);
  const saved = useRef(name);
  const commit = async () => {
    if (value.trim() === saved.current) return;
    const result = await rename(value);
    if (result?.ok) saved.current = value.trim();
    else setValue(saved.current);
    onResult(result);
  };
  return (
    <input
      className="ws-name"
      value={value}
      maxLength={60}
      aria-label="構成案の名前"
      title="クリックして名前を変更"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(saved.current);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function WorkshopHeader({
  name,
  busy,
  baseTemplateName,
  savedTemplateId,
  rename,
  sample,
  stop,
  saveOverwrite,
  saveNew,
  remove,
}: {
  name: string;
  busy: boolean;
  baseTemplateName: string | null;
  savedTemplateId: string | null;
  rename: (name: string) => Promise<ActionState>;
  sample: () => Promise<ActionState>;
  stop: () => Promise<ActionState>;
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
        <NameInput name={name} rename={rename} onResult={setResult} />
        <span className="muted">
          {baseTemplateName ? `元にした構成案: ${baseTemplateName}` : '新しい構成案'}
          {savedTemplateId && <> ・ <Link href={`/templates/${savedTemplateId}`}>保存した構成案を開く</Link></>}
        </span>
      </div>
      <div className="ws-actions">
        {result && <span className={`notice ${result.ok ? 'ok' : 'ng'}`}>{result.message}</span>}
        {/* AI が作業中（ボタンからの試作・チャットからの試作・相談の返事）は停止ボタンにする */}
        {busy ? (
          <HeaderButton action={stop} label="停止" pendingLabel="停止中…" icon={<Square size={14} fill="currentColor" />} className="danger" onResult={setResult} />
        ) : (
          <HeaderButton action={sample} label="試作する" pendingLabel="依頼中…" icon={<Play size={16} />} className="primary" onResult={setResult} />
        )}
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

// ---------- 左の列: AI に渡すプロンプト ----------

type PromptTab = { key: string; label: string; note: string; text: string };

export function PromptViewer({ tabs }: { tabs: PromptTab[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="ws-prompt">
      <div className="seg ws-prompt-tabs" role="tablist" aria-label="プロンプトの種類">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === active} className={t.key === active ? 'active' : ''} onClick={() => setActive(t.key)}>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <p className="muted">{tab.note}</p>
      <pre className="ws-prompt-text">{tab.text}</pre>
    </div>
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
  const composition = { component: ShortVideo, inputProps, durationInFrames, compositionWidth: 1080, compositionHeight: 1920, fps: 30 };

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
        <div className="ws-media">
          <div className="ws-player">
            <Player
              key={playerKey}
              {...composition}
              controls
              loop
              // 0 フレーム目は場面の入りのアニメーション前で何も見えないため、少し進めた位置で止めておく
              initialFrame={20}
              style={{ height: '100%', maxWidth: '100%', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden' }}
              errorFallback={({ error }) => (
                <div style={{ padding: 24, color: '#b91c1c', fontSize: 28 }}>この試作は表示できませんでした（場面の項目が足りない可能性）: {error.message}</div>
              )}
            />
          </div>
          <div className="ws-stills" aria-label="各行のコマ">
            {stillFrames.map((frame, i) => (
              <figure key={`${playerKey}-${i}`}>
                <Thumbnail {...composition} frameToDisplay={frame} style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 6, overflow: 'hidden' }} />
                <figcaption className="muted">{i + 1}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <div className="ws-text">
          <div className="stack" style={{ gap: 2, marginBottom: 10 }}>
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
    <form ref={form} action={run} className="stack" style={{ gap: 6 }}>
      <div className="chat-input">
        <textarea
          name="text"
          className="input"
          rows={3}
          placeholder="例: 冒頭2行で結論を言い切る型にして試作して / 5行目が長いので行数を減らして"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <button className="send-btn" disabled={pending || disabled} aria-label="送信" title="送信（Ctrl / ⌘ + Enter）">
          <Send size={18} />
        </button>
      </div>
      <span className="muted">Ctrl / ⌘ + Enter で送信。「試作して」と書けば、直した構成案で続けて試作します</span>
      {state && !state.ok && <p className="notice ng">{state.message}</p>}
    </form>
  );
}
