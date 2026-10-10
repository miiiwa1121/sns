import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentChannel } from '@/lib/channel';
import { safeJson } from '@/lib/json';
import { NoChannel } from '../ui';

export default async function ResearchPage() {
  const channel = await getCurrentChannel();
  if (!channel) return <div className="page"><h1>リサーチ</h1><NoChannel /></div>;
  const trends = await prisma.trendResearch.findMany({
    where: { accountId: channel.id },
    include: { projects: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="page">
      <h1>リサーチ</h1>
      <p className="lead">エージェントが調べて登録した話題と、その出典です。</p>
      {trends.length === 0 && <div className="card empty">まだリサーチはありません。</div>}
      {trends.map((t) => {
        const sources = safeJson<{ title: string; url: string }[]>(t.sourcesJson, []);
        return (
          <div key={t.id} className="card stack" style={{ gap: 8 }}>
            <span className="muted">{t.createdAt.toLocaleDateString('ja-JP')}</span>
            <strong>{t.topic}</strong>
            <p className="lead">{t.suggestedAngle}</p>
            {t.summary && <p className="muted">{t.summary}</p>}
            {sources.length > 0 && (
              <ul style={{ paddingLeft: 20 }}>
                {sources.map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-strong)' }}>{s.title}</a></li>
                ))}
              </ul>
            )}
            {t.projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="muted">→ 企画: {p.title}</Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
