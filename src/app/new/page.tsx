import Link from 'next/link';
import { getCurrentChannel } from '@/lib/channel';
import { JOB_STATUS_LABEL, PROVIDER_LABEL, loadJobs } from '@/lib/jobs';
import { NoChannel } from '../ui';
import { JobForm } from './client';

export default async function NewVideoPage() {
  const channel = await getCurrentChannel();
  if (!channel) return <div className="page"><h1>新しい動画を作る</h1><NoChannel /></div>;
  const jobs = await loadJobs(channel.id);
  const running = jobs.some((j) => j.status === 'running');

  return (
    <div className="page">
      <h1>新しい動画を作る</h1>
      <p className="lead">
        AI がリサーチ・台本・動画制作・点検まで行い、承認の手前で止まります。できあがるとホームの「あなたの番」に出てきます（10〜20分ほど）。
      </p>
      <JobForm disabled={running} />

      {jobs.length > 0 && (
        <section>
          <h2>これまでの依頼</h2>
          <div className="card flat list">
            {jobs.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`}>
                <div className="grow stack" style={{ gap: 4 }}>
                  <span className="title">{j.project?.title ?? j.theme ?? 'おまかせ'}</span>
                  <span className="muted">{j.createdAt.toLocaleString('ja-JP')} ・ {PROVIDER_LABEL[j.provider] ?? j.provider}</span>
                </div>
                <div className="side">
                  <span className={`badge${j.status === 'running' ? ' you' : j.status === 'succeeded' ? ' ok' : j.status === 'failed' ? ' ng' : ''}`}>
                    {JOB_STATUS_LABEL[j.status] ?? j.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
