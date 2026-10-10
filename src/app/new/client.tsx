'use client';

import { useActionState } from 'react';
import { createVideoJob } from '../actions';

export function JobForm({ disabled }: { disabled: boolean }) {
  const [state, run, pending] = useActionState(createVideoJob, null);
  return (
    <form action={run} className="card stack" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="theme">テーマ（任意）</label>
        <textarea id="theme" name="theme" className="input" rows={3} placeholder="例: 最近の AI エージェントの新機能&#10;空欄なら、直近の話題からおまかせで選びます" />
      </div>
      <div className="field">
        <label>作業する AI</label>
        <label className="row" style={{ gap: 8, fontWeight: 600 }}>
          <input type="radio" name="provider" value="claude-code" defaultChecked /> Claude Code（自動で最後まで進む）
        </label>
        <label className="row" style={{ gap: 8, fontWeight: 600 }}>
          <input type="radio" name="provider" value="antigravity" /> Antigravity / Gemini（IDE のチャットで進む。許可の操作が必要な場合あり）
        </label>
      </div>
      <div>
        <button className="btn primary" disabled={pending || disabled}>{pending ? '依頼中…' : '依頼する'}</button>
      </div>
      {disabled && <p className="muted">作業中の依頼が終わると、次を依頼できます。</p>}
      {state && !state.ok && <p className="notice ng">{state.message}</p>}
    </form>
  );
}
