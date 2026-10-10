'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import type { ActionState } from '@/app/actions';

// 作業画面のチャットの入力欄。送ったら空にする。Enter で改行、Ctrl/⌘ + Enter で送信
export function ChatForm({
  action,
  disabled,
  placeholder,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  disabled: boolean;
  placeholder: string;
}) {
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
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <button className="send-btn" disabled={pending || disabled} aria-label="送信" title="送信（Ctrl / ⌘ + Enter でも送れます）">
          <Send size={18} />
        </button>
      </div>
      {state && !state.ok && <p className="notice ng">{state.message}</p>}
    </form>
  );
}

// チャット欄の上で、この画面の AI とモデルを選ぶ（選んだらすぐ保存。次に送る相談から使われる）。
// 選べるのは今使える AI と、その AI のモデルだけ。AI を変えるとモデルはその AI の既定になる
export function ChatAiPicker({
  providers,
  models,
  defaults,
  provider: initialProvider,
  model: initialModel,
  unavailable,
  save,
}: {
  providers: { id: string; label: string }[];
  models: Record<string, { id: string; label: string }[]>;
  defaults: Record<string, string>;
  provider: string | null; // 今の設定の AI が使えなくなっていたら null
  model: string;
  unavailable: string | null;
  save: (provider: string, model: string) => Promise<ActionState>;
}) {
  const [provider, setProvider] = useState(initialProvider ?? '');
  const [model, setModel] = useState(initialModel);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const commit = (p: string, m: string) => {
    setProvider(p);
    setModel(m);
    start(async () => {
      const result = await save(p, m);
      setError(result?.ok ? null : result?.message ?? '保存できませんでした');
    });
  };
  if (providers.length === 0) return <p className="notice ng">使える AI がありません（「AI 連携」で追加してください）</p>;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="chat-ai">
        <span className="muted">AI</span>
        <select className="input" aria-label="使う AI" value={provider} disabled={pending} onChange={(e) => commit(e.target.value, defaults[e.target.value] ?? '')}>
          {!provider && <option value="" disabled>選んでください</option>}
          {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select className="input" aria-label="モデル" value={model} disabled={pending || !provider} onChange={(e) => commit(provider, e.target.value)}>
          {(models[provider] ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      {error && <p className="notice ng">{error}</p>}
      {!provider && unavailable && <p className="notice ng">今の設定の {unavailable} は使えないため、選び直してください</p>}
    </div>
  );
}
