import Link from 'next/link';
import { getCurrentChannel } from '@/lib/channel';
import { loadProjects } from '@/lib/queries';
import { NoChannel, OwnerBadge, StepBar } from '../ui';

export default async function ProjectsPage() {
  const channel = await getCurrentChannel();
  if (!channel) return <div className="page"><h1>企画</h1><NoChannel /></div>;
  const items = await loadProjects(channel.id);

  return (
    <div className="page">
      <div className="row between">
        <h1>企画</h1>
        <Link href="/new" className="btn primary">新しい動画を作る</Link>
      </div>
      <div className="card flat list">
        {items.length === 0 ? (
          <div className="empty" style={{ display: 'block' }}>まだ企画はありません。</div>
        ) : (
          items.map(({ project, next }) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="grow stack" style={{ gap: 6 }}>
                <span className="title">{project.title}</span>
                <span className="muted">{project.createdAt.toLocaleDateString('ja-JP')} 作成</span>
                <StepBar next={next} labels />
              </div>
              <div className="side">
                <OwnerBadge next={next} />
                <span style={{ fontWeight: 700 }}>{next.label}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
