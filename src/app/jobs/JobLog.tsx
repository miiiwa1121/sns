import { JOB_STEPS, LogEntry, jobProgress } from '@/lib/jobs';

// 依頼の工程の帯と作業の記録。作業状況・依頼の詳細で使う
export function JobProgress({ phase, done }: { phase: string | null; done: boolean }) {
  const step = done ? JOB_STEPS.length : jobProgress(phase);
  return (
    <div>
      <div className="steps">
        {JOB_STEPS.map((s, i) => <span key={s} className={i < step ? 'done' : i === step ? 'now' : ''} />)}
      </div>
      <div className="step-labels">
        {JOB_STEPS.map((s, i) => <span key={s} className={i === step ? 'now' : ''}>{s}</span>)}
      </div>
    </div>
  );
}

export function JobLog({ entries, limit }: { entries: LogEntry[]; limit?: number }) {
  const shown = limit ? entries.slice(-limit) : entries;
  if (shown.length === 0) return <p className="muted">開始しています…</p>;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {limit && entries.length > limit && <p className="muted">（最新 {limit} 件を表示）</p>}
      {shown.map((e, i) =>
        e.kind === 'tool' ? (
          <p key={i} className="muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, overflowWrap: 'anywhere' }}>▸ {e.detail}</p>
        ) : (
          <p key={i} style={{ whiteSpace: 'pre-wrap', color: e.kind === 'result' && e.error ? 'var(--danger)' : undefined, fontWeight: e.kind === 'result' ? 700 : 400 }}>
            {e.text}
          </p>
        )
      )}
    </div>
  );
}
