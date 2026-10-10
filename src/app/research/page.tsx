import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';

export default async function ResearchPage() {
  const trends = await prisma.trendResearch.findMany({
    include: { account: { select: { name: true } }, projects: { select: { id: true, title: true } } },
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
            <div className="row between" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
                <span className="muted">{t.account.name} ・ {t.createdAt.toLocaleDateString('ja-JP')}</span>
                <strong>{t.topic}</strong>
              </div>
              {/* このリサーチから作った企画へ */}
              {t.projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="btn primary" title={p.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  企画を開く
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
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
              <span key={p.id} className="muted">企画: {p.title}</span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
