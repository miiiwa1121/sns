import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { JOB_STATUS_LABEL, PROVIDER_LABEL, elapsed, loadRunningJobs, readJobLog } from '@/lib/jobs';
import { AutoRefresh } from '../jobs/[id]/client';
import { JobLog, JobProgress } from '../jobs/JobLog';

// 作業中の依頼をリアルタイムに確認する（全アカウント横断。作業中は2秒ごとに更新）
export default async function ActivityPage() {
  const [running, recent] = await Promise.all([
    loadRunningJobs(),
    prisma.agentJob.findMany({
      where: { status: { not: 'running' } },
      include: { account: true, project: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <div className="page">
      <AutoRefresh active={running.length > 0} interval={2000} />
      <h1>作業状況</h1>

      <section className="stack" style={{ gap: 16 }}>
        <h2 style={{ margin: 0 }}>作業中</h2>
        {running.length === 0 && (
          <div className="card empty">
            作業中の依頼はありません。<Link href="/new" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>新しい動画を作る</Link>
          </div>
        )}
        {running.map((j) => {
          const log = j.provider === 'claude-code' ? readJobLog(j.id) : [];
          return (
            <div key={j.id} className="card stack" style={{ gap: 14 }}>
              <div className="row between">
                <div className="stack" style={{ gap: 2 }}>
                  <span className="muted">{j.account.name} ・ {PROVIDER_LABEL[j.provider] ?? j.provider} ・ 経過 {elapsed(j.createdAt)}</span>
                  <strong>{j.project?.title ?? j.theme ?? 'おまかせ'}</strong>
                </div>
                <Link href={`/jobs/${j.id}`} className="btn">詳細</Link>
              </div>
              {j.provider === 'claude-code' ? (
                <>
                  <JobProgress entries={log} done={false} />
                  <div style={{ maxHeight: 420, overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <JobLog entries={log} limit={30} />
                  </div>
                </>
              ) : (
                <p className="lead">Antigravity IDE で作業中です。進み具合は IDE で確認してください。</p>
              )}
            </div>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section>
          <h2>最近の依頼</h2>
          <div className="card flat list">
            {recent.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`}>
                <div className="grow stack" style={{ gap: 4 }}>
                  <span className="title">{j.project?.title ?? j.theme ?? 'おまかせ'}</span>
                  <span className="muted">
                    {j.account.name} ・ {j.createdAt.toLocaleString('ja-JP')} ・ {elapsed(j.createdAt, j.finishedAt ?? undefined)}
                  </span>
                </div>
                <div className="side">
                  <span className={`badge${j.status === 'succeeded' ? ' ok' : j.status === 'failed' ? ' ng' : ''}`}>{JOB_STATUS_LABEL[j.status] ?? j.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
