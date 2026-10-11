'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ActionState } from '../actions';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
// ---------- 行ごとの操作（接続テスト・削除） ----------

function TestButton({ action }: { action: () => Promise<ActionState> }) {
  const [state, run, pending] = useActionState<ActionState>(async () => action(), null);
  return (
    <form action={run} className="row-test">
      <button className="btn sm" disabled={pending}>{pending ? '試しています…' : '接続テスト'}</button>
      {state && <span className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</span>}
    </form>
  );
}

function DeleteButton({ action, confirmText, label }: { action: () => Promise<ActionState>; confirmText: string; label: string }) {
  const [state, run, pending] = useActionState<ActionState>(async () => action(), null);
  return (
    <form action={run} onSubmit={(e) => !window.confirm(confirmText) && e.preventDefault()}>
      <button className="icon-btn sm danger" disabled={pending} title="消す" aria-label={`${label} を消す`}>
        <Trash2 size={14} />
      </button>
      {state && !state.ok && <span className="notice ng">{state.message}</span>}
    </form>
  );
}

// ＋で足す入力行の管理（複数同時に足せる。保存かやめるで消える）
function useDrafts() {
  const [drafts, setDrafts] = useState<number[]>([]);
  const [nextId, setNextId] = useState(0);
  return {
    drafts,
    add: () => {
      setDrafts((d) => [...d, nextId]);
      setNextId((n) => n + 1);
    },
    drop: (id: number) => setDrafts((d) => d.filter((x) => x !== id)),
  };
}

function DraftForm({ action, onDone, children }: { action: Action; onDone: () => void; children: React.ReactNode }) {
  const [state, run, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result?.ok) onDone();
    return result;
  }, null);
  return (
    <div className="draft-row">
      <form action={run} className="key-form">
        {children}
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : '保存'}</button>
        <button type="button" className="btn" onClick={onDone}>やめる</button>
      </form>
      {state && !state.ok && <p className="notice ng">{state.message}</p>}
    </div>
  );
}

// ---------- API キー ----------

type KeyRow = { label: string; envName: string; masked: string | null; usedBy: string | null };

// 名前・環境変数名・値を1行として、＋で足す。値は .env.local に保存し、末尾4文字だけ表示する。1つもなければ＋のボタンだけ
export function ApiKeysTable({
  rows,
  add,
  remove,
  test,
}: {
  rows: KeyRow[];
  add: Action;
  remove: (envName: string) => Promise<ActionState>;
  test: (envName: string) => Promise<ActionState>;
}) {
  const d = useDrafts();
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.length > 0 && (
        <table>
          <thead>
            <tr><th>名前</th><th>環境変数名</th><th>値</th><th aria-label="接続テスト" /><th aria-label="削除" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.envName}>
                <td>
                  {r.label}
                  {r.usedBy && <span className="badge ok" style={{ marginLeft: 8 }}>{r.usedBy}</span>}
                </td>
                <td className="mono">{r.envName}</td>
                <td className="mono">{r.masked ?? <span className="muted">（値なし）</span>}</td>
                <td><TestButton action={() => test(r.envName)} /></td>
                <td style={{ width: 40 }}>
                  <DeleteButton action={() => remove(r.envName)} label={r.label} confirmText={`「${r.label}」の API キーを消します。よろしいですか？`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.drafts.map((id) => (
        <DraftForm key={id} action={add} onDone={() => d.drop(id)}>
          <input name="label" className="input" placeholder="名前（例: Claude API）" maxLength={40} autoComplete="off" />
          <input name="envName" className="input mono" placeholder="環境変数名（例: ANTHROPIC_API_KEY）" maxLength={64} autoComplete="off" />
          <input name="value" type="password" className="input" placeholder="値（例: sk-ant-…）" autoComplete="off" />
        </DraftForm>
      ))}
      <div>
        <button type="button" className="btn" onClick={d.add}>
          <Plus size={14} />
          キーを追加
        </button>
      </div>
    </div>
  );
}

// ---------- API 以外の AI ----------

type LocalRow = { kind: string; kindLabel: string; label: string; binPath: string; summary: string; ready: boolean; version: string | null };

export function LocalAiTable({
  rows,
  kinds,
  addable,
  add,
  remove,
  test,
}: {
  rows: LocalRow[];
  kinds: string[]; // 追加できる種類の名前（すべて）
  addable: { kind: string; label: string; defaultBin: string }[]; // まだ登録していない種類
  add: Action;
  remove: (kind: string) => Promise<ActionState>;
  test: (kind: string) => Promise<ActionState>;
}) {
  const d = useDrafts();
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.length > 0 && (
        <table>
          <thead>
            <tr><th>名前</th><th>種類</th><th>場所</th><th>状態</th><th aria-label="接続テスト" /><th aria-label="削除" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind}>
                <td>{r.label}</td>
                <td>{r.kindLabel}</td>
                <td className="mono" style={{ wordBreak: 'break-all' }}>{r.binPath}</td>
                <td>
                  <span className={`badge${r.ready ? ' ok' : ''}`}>{r.summary}</span>
                  {r.version && <div className="muted">{r.version}</div>}
                </td>
                <td><TestButton action={() => test(r.kind)} /></td>
                <td style={{ width: 40 }}>
                  <DeleteButton action={() => remove(r.kind)} label={r.label} confirmText={`「${r.label}」を連携から外します。よろしいですか？（パソコンからは消えません）`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.drafts.map((id) => (
        <LocalDraft key={id} addable={addable} action={add} onDone={() => d.drop(id)} />
      ))}
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn" onClick={d.add} disabled={addable.length === 0 || d.drafts.length >= addable.length}>
          <Plus size={14} />
          AI を追加
        </button>
        {addable.length === 0 && <span className="muted">今追加できる種類（{kinds.join('・')}）は、すべて追加済みです</span>}
      </div>
    </div>
  );
}

// 種類を選ぶと、名前と場所に既定の値が入る
function LocalDraft({ addable, action, onDone }: { addable: { kind: string; label: string; defaultBin: string }[]; action: Action; onDone: () => void }) {
  const [kind, setKind] = useState(addable[0]?.kind ?? '');
  const current = addable.find((a) => a.kind === kind);
  return (
    <DraftForm action={action} onDone={onDone}>
      <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="種類">
        {addable.map((a) => <option key={a.kind} value={a.kind}>{a.label}</option>)}
      </select>
      <input key={`l-${kind}`} name="label" className="input" defaultValue={current?.label ?? ''} placeholder="名前" maxLength={40} autoComplete="off" />
      <input key={`b-${kind}`} name="binPath" className="input mono" defaultValue={current?.defaultBin ?? ''} placeholder="場所（例: /Users/…/bin/claude）" autoComplete="off" />
    </DraftForm>
  );
}
