'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ActionState } from '../actions';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Row = { id: string; text: string; isDefault: boolean; update: Action; remove: () => Promise<ActionState> };

function Fields({ text = '', isDefault = true }: { text?: string; isDefault?: boolean }) {
  return (
    <>
      <input name="text" className="input" maxLength={300} defaultValue={text} placeholder="例: 視聴者をあおる言い回し（「知らないと損」など）は使わない。" />
      <label className="row muted" style={{ gap: 6, whiteSpace: 'nowrap' }}>
        <input type="checkbox" name="isDefault" defaultChecked={isDefault} /> 最初から選ぶ
      </label>
    </>
  );
}

function RowForm({ row }: { row: Row }) {
  const [state, run, pending] = useActionState(row.update, null);
  const [removeState, remove, removing] = useActionState<ActionState>(async () => row.remove(), null);
  const message = removeState && !removeState.ok ? removeState : state;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="prohibition-row">
        <form action={run} className="prohibition-form">
          <Fields text={row.text} isDefault={row.isDefault} />
          <button className="btn sm" disabled={pending}>{pending ? '保存中…' : '保存'}</button>
        </form>
        <form action={remove} onSubmit={(e) => !window.confirm(`「${row.text}」を消します。よろしいですか？`) && e.preventDefault()}>
          <button className="icon-btn sm danger" disabled={removing} title="消す" aria-label="この禁止事項を消す">
            <Trash2 size={14} />
          </button>
        </form>
      </div>
      {message && <p className={`notice ${message.ok ? 'ok' : 'ng'}`}>{message.message}</p>}
    </div>
  );
}

// ＋で足す入力行。保存できたら閉じる
function DraftForm({ action, onDone }: { action: Action; onDone: () => void }) {
  const [state, run, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok) onDone();
    return result;
  }, null);
  return (
    <div className="draft-row">
      <form action={run} className="prohibition-form">
        <Fields />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary sm" disabled={pending}>{pending ? '保存中…' : '保存'}</button>
          <button type="button" className="btn sm" onClick={onDone}>やめる</button>
        </div>
      </form>
      {state && !state.ok && <p className="notice ng">{state.message}</p>}
    </div>
  );
}

export function ProhibitionList({ rows, create }: { rows: Row[]; create: Action }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.length > 0 && (
        <div className="card flat list">
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'block' }}>
              <RowForm row={r} />
            </div>
          ))}
        </div>
      )}
      {adding && <DraftForm action={create} onDone={() => setAdding(false)} />}
      {!adding && (
        <div>
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            <Plus size={14} />
            禁止事項を追加
          </button>
        </div>
      )}
    </div>
  );
}
