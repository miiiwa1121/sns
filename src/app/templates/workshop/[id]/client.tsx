'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Film, Play, Square, Text, Trash2 } from 'lucide-react';
import type { ScriptLine } from '@/lib/script';
import { ScriptPlayer } from '@/app/components/script-preview';
import type { ActionState } from '@/app/actions';

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
  rename,
  sample,
  stop,
  remove,
}: {
  name: string;
  busy: boolean;
  rename: (name: string) => Promise<ActionState>;
  sample: () => Promise<ActionState>;
  stop: () => Promise<ActionState>;
  remove: () => Promise<ActionState>;
}) {
  const [result, setResult] = useState<ActionState>(null);
  // 結果のメッセージ（「名前を変えました」など）は数秒で消す。失敗は少し長めに出す
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.ok ? 3000 : 6000);
    return () => clearTimeout(t);
  }, [result]);
  return (
    <header className="ws-header">
      <Link href="/templates" className="btn" aria-label="構成案一覧に戻る" title="構成案一覧に戻る">
        <ArrowLeft size={14} />
        戻る
      </Link>
      <div className="ws-title">
        <NameInput name={name} rename={rename} onResult={setResult} />
      </div>
      <div className="ws-actions">
        {result && <span className={`notice ${result.ok ? 'ok' : 'ng'}`}>{result.message}</span>}
        {/* AI が作業中（ボタンからの試作・チャットからの試作・相談の返事）は停止ボタンにする */}
        {busy ? (
          <HeaderButton action={stop} label="停止" pendingLabel="停止中…" icon={<Square size={14} fill="currentColor" />} className="danger" onResult={setResult} />
        ) : (
          <HeaderButton action={sample} label="試作する" pendingLabel="依頼中…" icon={<Play size={16} />} className="primary" onResult={setResult} />
        )}
        {/* 名前の変更と AI の修正は、その場で構成案に保存される */}
        <span className="muted ws-autosave" title="名前の変更や AI の修正は、その場で構成案に保存されます">
          <Check size={14} />
          自動保存
        </span>
        <HeaderButton
          action={remove}
          label="削除"
          pendingLabel="削除中…"
          icon={<Trash2 size={16} />}
          className="danger"
          confirm={`構成案「${name}」と、この相談（会話と試作）を削除します。元に戻せません。よろしいですか？`}
          onResult={setResult}
        />
      </div>
    </header>
  );
}

// ---------- 左の列: AI に渡すプロンプト ----------

// プロンプトの各節が、どこから来た情報か。構成案から来る節だけを強調し、ほかはラベルで示す
type PromptSource = 'template' | 'account' | 'research' | 'prohibition' | 'topic' | 'conversation' | 'fixed';

const SOURCE_LABEL: Record<PromptSource, string> = {
  template: '構成案から',
  account: 'アカウントから',
  research: 'リサーチ手法から',
  prohibition: '禁止事項から',
  topic: '話題から',
  conversation: '会話から',
  fixed: '固定',
};

// 見出しで出どころを決める（見出しは agent/job-prompt.ts と src/lib/services/workshopService.ts で組み立てている）
const SOURCE_BY_HEADING: [RegExp, PromptSource][] = [
  [/^## (構成案|今の構成案の下書き)/, 'template'],
  [/^## チャンネル/, 'account'],
  [/^## リサーチ手法/, 'research'],
  [/^## 禁止事項/, 'prohibition'],
  [/^## (今回の依頼|試作の話題|話題|リサーチの結果)/, 'topic'],
  [/^## (これまでのやりとり|担当者の今回の発言)/, 'conversation'],
];

function splitPrompt(text: string): { source: PromptSource; text: string }[] {
  const sections: { source: PromptSource; text: string }[] = [];
  for (const line of text.split('\n')) {
    if (/^#{1,2} /.test(line) || sections.length === 0) {
      const source = SOURCE_BY_HEADING.find(([re]) => re.test(line))?.[1] ?? 'fixed';
      sections.push({ source, text: line });
    } else {
      sections[sections.length - 1].text += `\n${line}`;
    }
  }
  return sections.map((sec) => ({ ...sec, text: sec.text.trimEnd() }));
}

type PromptTab = { key: string; label: string; note: string; text: string };

export function PromptViewer({ tabs }: { tabs: PromptTab[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  const sections = splitPrompt(tab.text);
  const used = new Set(sections.map((sec) => sec.source));
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
      <div className="ws-legend">
        {(Object.keys(SOURCE_LABEL) as PromptSource[]).filter((src) => used.has(src)).map((src) => (
          <span key={src} className={`ws-src ${src}`}>{SOURCE_LABEL[src]}</span>
        ))}
      </div>
      <div className="ws-prompt-text">
        {sections.map((sec, i) => (
          <section key={i} className={`ws-sec ${sec.source}`}>
            <span className={`ws-src ${sec.source}`}>{SOURCE_LABEL[sec.source]}</span>
            <pre>{sec.text}</pre>
          </section>
        ))}
      </div>
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
        // 試作を切り替えたら作り直して頭から再生する
        <ScriptPlayer key={title} title={title} lines={lines} brandName={brandName} handle={handle} />
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
