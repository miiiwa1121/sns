'use client';

import { useActionState, useState } from 'react';
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

export function ApiKeyForm({ action, placeholder }: { action: Action; placeholder: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8 }}>
        <input name="apiKey" type="password" className="input" placeholder={placeholder} autoComplete="off" style={{ flex: 1 }} />
        <button className="btn" disabled={pending}>{pending ? '保存中…' : 'API キーを保存'}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}

export function PathsForm({ action, values }: { action: Action; values: { claudeBinPath: string; antigravityBinPath: string; claudeDefault: string; antigravityDefault: string } }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="stack" style={{ gap: 10 }}>
      <label className="field">
        <span>Claude Code の場所</span>
        <input name="claudeBinPath" className="input" defaultValue={values.claudeBinPath} placeholder={values.claudeDefault} />
      </label>
      <label className="field">
        <span>Antigravity の場所</span>
        <input name="antigravityBinPath" className="input" defaultValue={values.antigravityBinPath} placeholder={values.antigravityDefault} />
      </label>
      <div className="row between">
        <span className="muted">空欄なら既定の場所（薄く表示しているもの）を使います</span>
        <button className="btn" disabled={pending}>{pending ? '保存中…' : '保存する'}</button>
      </div>
      <Notice state={state} />
    </form>
  );
}
