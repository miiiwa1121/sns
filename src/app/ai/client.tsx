'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ActionState } from '../actions';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; label: string };
type PurposeRow = {
  purpose: 'job' | 'workshop' | 'edit';
  label: string;
  note: string;
  providers: { id: string; label: string; ready: boolean }[];
  provider: string;
  model: string;
};

function Notice({ state }: { state: ActionState }) {
  if (!state) return null;
  return <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>;
}

// 用途ごとの割り当て。AI を変えると、モデルの候補もその AI のものに変わる（候補にないモデル名も入力できる）
export function AssignmentsForm({ action, rows, models }: { action: Action; rows: PurposeRow[]; models: Record<string, Option[]> }) {
  const [state, run, pending] = useActionState(action, null);
  const [providers, setProviders] = useState(() => Object.fromEntries(rows.map((r) => [r.purpose, r.provider])));
  return (
    <form action={run} className="stack" style={{ gap: 12 }}>
      <table>
        <thead>
          <tr><th>用途</th><th>使う AI</th><th>モデル</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const provider = providers[r.purpose];
            const options = models[provider] ?? [];
            return (
              <tr key={r.purpose}>
                <td>
                  <strong>{r.label}</strong>
                  <div className="muted">{r.note}</div>
                </td>
                <td>
                  <select name={`${r.purpose}Provider`} className="input" value={provider} onChange={(e) => setProviders({ ...providers, [r.purpose]: e.target.value })}>
                    {r.providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}{p.ready ? '' : '（未設定）'}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {provider === 'antigravity' ? (
                    <span className="muted">IDE で選びます</span>
                  ) : (
                    <>
                      <input
                        name={`${r.purpose}Model`}
                        className="input"
                        list={`models-${r.purpose}`}
                        defaultValue={r.provider === provider ? r.model : ''}
                        key={provider}
                        placeholder="空欄なら既定"
                        autoComplete="off"
                      />
                      <datalist id={`models-${r.purpose}`}>
                        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </datalist>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div>
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : '保存する'}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

type KeyRow = { label: string; envName: string; masked: string | null; usedBy: string | null };

// 追加中の1行（名前・環境変数名・値）。保存したら消える
function NewKeyRow({ action, onDone, onCancel }: { action: Action; onDone: () => void; onCancel: () => void }) {
  const [state, run, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok) onDone();
    return result;
  }, null);
  return (
    <tr>
      <td colSpan={4}>
        <form action={run} className="key-form">
          <input name="label" className="input" placeholder="名前（例: Claude API）" maxLength={40} autoComplete="off" />
          <input name="envName" className="input mono" placeholder="環境変数名（例: ANTHROPIC_API_KEY）" maxLength={64} autoComplete="off" />
          <input name="value" type="password" className="input" placeholder="値（例: sk-ant-…）" autoComplete="off" />
          <button className="btn primary" disabled={pending}>{pending ? '保存中…' : '保存'}</button>
          <button type="button" className="btn" onClick={onCancel}>やめる</button>
        </form>
        {state && !state.ok && <p className="notice ng">{state.message}</p>}
      </td>
    </tr>
  );
}

function DeleteKeyButton({ action, label }: { action: () => Promise<ActionState>; label: string }) {
  const [state, run, pending] = useActionState<ActionState>(async () => action(), null);
  return (
    <form action={run} onSubmit={(e) => !window.confirm(`「${label}」の API キーを消します。よろしいですか？`) && e.preventDefault()}>
      <button className="icon-btn sm danger" disabled={pending} title="消す" aria-label={`${label} を消す`}>
        <Trash2 size={14} />
      </button>
      {state && !state.ok && <span className="notice ng">{state.message}</span>}
    </form>
  );
}

// API キーの一覧。＋で行を足し、名前・環境変数名・値を入れて保存する（値は .env.local に保存し、末尾4文字だけ表示）
export function ApiKeysTable({
  rows,
  add,
  remove,
}: {
  rows: KeyRow[];
  add: Action;
  remove: (envName: string) => Promise<ActionState>;
}) {
  const [drafts, setDrafts] = useState<number[]>([]);
  const [nextId, setNextId] = useState(0);
  const addDraft = () => {
    setDrafts([...drafts, nextId]);
    setNextId(nextId + 1);
  };
  const dropDraft = (id: number) => setDrafts(drafts.filter((d) => d !== id));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <table>
        <thead>
          <tr><th>名前</th><th>環境変数名</th><th>値</th><th aria-label="操作" /></tr>
        </thead>
        <tbody>
          {rows.length === 0 && drafts.length === 0 && (
            <tr><td colSpan={4} className="muted">まだ登録していません。＋で追加します。</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.envName}>
              <td>
                {r.label}
                {r.usedBy && <span className="badge ok" style={{ marginLeft: 8 }}>{r.usedBy}で使用</span>}
              </td>
              <td className="mono">{r.envName}</td>
              <td className="mono">{r.masked ?? <span className="muted">（値なし）</span>}</td>
              <td style={{ width: 40 }}><DeleteKeyButton action={() => remove(r.envName)} label={r.label} /></td>
            </tr>
          ))}
          {drafts.map((id) => (
            <NewKeyRow key={id} action={add} onDone={() => dropDraft(id)} onCancel={() => dropDraft(id)} />
          ))}
        </tbody>
      </table>
      <div>
        <button type="button" className="btn" onClick={addDraft}>
          <Plus size={14} />
          キーを追加
        </button>
      </div>
    </div>
  );
}
