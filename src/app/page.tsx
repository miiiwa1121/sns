import Link from 'next/link';
import { loadYourTurn, Task } from '@/lib/queries';
import { jobAiLabel, loadRunningJobs } from '@/lib/jobs';
import { OwnerBadge, StepBar, formatDate } from './ui';

function TaskRow({ task, showDue }: { task: Task; showDue?: boolean }) {
  return (
    <Link href={`/projects/${task.project.id}`}>
      <div className="grow stack" style={{ gap: 6 }}>
        <span className="muted">{task.project.account.name}</span>
        <span className="title">{task.project.title}</span>
        <StepBar next={task.next} />
      </div>
      <div className="side">
        <OwnerBadge next={task.next} />
        <span style={{ fontWeight: 700 }}>{task.next.label}</span>
        {showDue && task.next.dueAt && <span className="muted">{formatDate(task.next.dueAt)} 以降</span>}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [{ now, later, agent }, runningJobs] = await Promise.all([loadYourTurn(), loadRunningJobs()]);

  return (
    <div className="page">
      <h1>ホーム</h1>

      {runningJobs.length > 0 && (
        <section>
          <h2>作業中の依頼</h2>
          <div className="card flat list">
            {runningJobs.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`}>
                <div className="grow stack" style={{ gap: 4 }}>
                  <span className="muted">{j.account.name}</span>
                  <span className="title">{j.project?.title ?? j.theme ?? 'おまかせ'}</span>
                </div>
                <div className="side">
                  <span className="badge">{jobAiLabel(j)}</span>
                  <span style={{ fontWeight: 700 }}>作業中</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>あなたの番</h2>
        <div className="card flat list">
          {now.length === 0 ? (
            <div className="empty" style={{ display: 'block' }}>
              <p>今やることはありません。</p>
              <p className="muted">
                次の動画は<Link href="/new" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>「作成する」</Link>から依頼できます。
              </p>
            </div>
          ) : (
            now.map((t) => <TaskRow key={t.project.id} task={t} />)
          )}
        </div>
      </section>

      {later.length > 0 && (
        <section>
          <h2>あとでやること</h2>
          <div className="card flat list">
            {later.map((t) => <TaskRow key={t.project.id} task={t} showDue />)}
          </div>
        </section>
      )}

      {agent.length > 0 && (
        <section>
          <h2>エージェントの番</h2>
          <div className="card flat list">
            {agent.map((t) => <TaskRow key={t.project.id} task={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
