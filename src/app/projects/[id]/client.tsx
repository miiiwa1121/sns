'use client';

import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { ActionState } from '@/app/actions';

function Notice({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>;
}

// 押すだけの操作（承認・YouTube 投稿・数字の取得）。結果のメッセージをボタンの下に出す
export function ActionButton({
  action,
  label,
  pendingLabel,
  primary,
  confirm,
}: {
  action: () => Promise<ActionState>;
  label: string;
  pendingLabel: string;
  primary?: boolean;
  confirm?: string;
}) {
  const [state, run, pending] = useActionState<ActionState>(async () => action(), null);
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="stack"
      style={{ gap: 6 }}
    >
      <div>
        <button className={`btn${primary ? ' primary' : ''}`} disabled={pending}>
          {pending ? pendingLabel : label}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

// 入力欄つきの操作（投稿 URL の記録・数字の入力）
export function ActionForm({
  action,
  children,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="stack" style={{ gap: 10 }}>
      {children}
      <div>
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : submitLabel}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? 'コピーしました' : 'コピー'}
    </button>
  );
}
