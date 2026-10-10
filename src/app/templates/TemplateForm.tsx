'use client';

import { useActionState } from 'react';
import type { ActionState } from '../actions';

type Values = { name?: string; description?: string | null; body?: string };

export function TemplateForm({
  action,
  values = {},
  isNew,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: Values;
  isNew?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="card stack" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="name">名前</label>
        <input id="name" name="name" className="input" maxLength={60} defaultValue={values.name ?? ''} placeholder="例: 比較で見せる（40秒）" />
      </div>
      <div className="field">
        <label htmlFor="description">説明（任意）</label>
        <input id="description" name="description" className="input" maxLength={200} defaultValue={values.description ?? ''} placeholder="例: 新旧の違いを左右に並べて見せる。機能のアップデート向け" />
      </div>
      <div className="field">
        <label htmlFor="body">構成の指示</label>
        <textarea id="body" name="body" className="input" rows={12} maxLength={4000} defaultValue={values.body ?? ''} placeholder={'例:\n- 尺は 35〜45 秒（10〜12 行）。\n- 1行目は hook。2行目で何が変わったかを keyword で出す。\n- 中盤は compare で「これまで」と「これから」を並べる。\n- 最後の行は outro。'} />
        <span className="muted">尺・行数・流れ・場面の選び方などを、箇条書きで AI に伝えます。使える場面の種類と、事実・出典・禁止事項のルールは指示書に固定で入るので、ここに書く必要はありません。</span>
      </div>
      <div>
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : isNew ? '構成案を追加する' : '保存する'}</button>
      </div>
      {state && <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>}
    </form>
  );
}
