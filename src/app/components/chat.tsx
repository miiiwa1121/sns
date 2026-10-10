'use client';

import { useActionState, useRef } from 'react';
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
