import Link from 'next/link';
import { NextAction, STEPS } from '@/lib/workflow';

// 工程の帯（台本 → 制作 → 承認 → 配信 → 計測・分析）
export function StepBar({ next, labels = false }: { next: NextAction; labels?: boolean }) {
  const state = (i: number) => (next.owner === 'done' || i < next.step ? 'done' : i === next.step ? 'now' : '');
  return (
    <div>
      <div className="steps">
        {STEPS.map((s, i) => <span key={s} className={state(i)} />)}
      </div>
      {labels && (
        <div className="step-labels">
          {STEPS.map((s, i) => <span key={s} className={state(i) === 'now' ? 'now' : ''}>{s}</span>)}
        </div>
      )}
    </div>
  );
}

export function OwnerBadge({ next }: { next: NextAction }) {
  if (next.owner === 'done') return <span className="badge ok">完了</span>;
  if (next.owner === 'agent') return <span className="badge">エージェント</span>;
  return <span className="badge you">あなた</span>;
}

export function formatDate(d: Date) {
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function NoChannel() {
  return (
    <div className="card empty">
      <p>アカウントが登録されていません。</p>
      <p className="muted"><Link href="/accounts/new" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>アカウントを追加する</Link></p>
    </div>
  );
}
