'use client';

import { useActionState } from 'react';
import type { ActionState } from '../actions';

type Values = { name?: string; description?: string | null; body?: string };

export function ResearchMethodForm({
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
        <input id="name" name="name" className="input" maxLength={60} defaultValue={values.name ?? ''} placeholder="例: 公式ブログだけ（直近3日）" />
      </div>
      <div className="field">
        <label htmlFor="description">説明（任意）</label>
        <input id="description" name="description" className="input" maxLength={200} defaultValue={values.description ?? ''} placeholder="例: 公式の発表だけから選ぶ。速報より正確さを優先したいとき向け" />
      </div>
      <div className="field">
        <label htmlFor="body">リサーチの指示</label>
        <textarea id="body" name="body" className="input" rows={10} maxLength={4000} defaultValue={values.body ?? ''} placeholder={'例:\n- 対象期間: 直近3日。\n- 調べる場所: 各社の公式ブログ・リリースノートだけ。\n- 話題の選び方: 無料で今日から試せるものを優先する。'} />
        <span className="muted">対象期間・調べる場所・話題の選び方などを、箇条書きで AI に伝えます。出典に一次情報を含めること・事実は出典どおりに書くことは指示書に固定で入るので、ここに書く必要はありません。</span>
      </div>
      <div>
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : isNew ? 'リサーチ手法を追加する' : '保存する'}</button>
      </div>
      {state && <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>}
    </form>
  );
}
