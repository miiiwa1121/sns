import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentChannel } from '@/lib/channel';
import { weightedRetention } from '@/lib/agents/performanceDiagnosis';
import { NoChannel } from '../ui';

export default async function InsightsPage() {
  const channel = await getCurrentChannel();
  if (!channel) return <div className="page"><h1>分析・知見</h1><NoChannel /></div>;
  const [projects, knowledge] = await Promise.all([
    prisma.project.findMany({
      where: { accountId: channel.id, analytics: { some: {} } },
      include: { analytics: true, template: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agentKnowledge.findMany({ where: { accountId: channel.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const byTemplate = compareTemplates(projects);

  return (
    <div className="page">
      <h1>分析・知見</h1>

      <section>
        <h2>構成案ごとの成績</h2>
        <p className="lead" style={{ marginBottom: 12 }}>
          数字が入った動画を、台本づくりに使った構成案ごとにまとめています。本数が少ないうちは、話題の当たり外れの影響が大きいので参考程度に見てください。
        </p>
        <div className="card flat">
          {byTemplate.length === 0 ? (
            <div className="empty">まだ数字が入った動画はありません。</div>
          ) : (
            <table>
              <thead>
                <tr><th>構成案</th><th>本数</th><th>1本あたりの再生数</th><th>視聴維持率</th><th>いいね率</th><th>合計再生数</th></tr>
              </thead>
              <tbody>
                {byTemplate.map((t) => (
                  <tr key={t.id ?? 'none'}>
                    <td>{t.id ? <Link href={`/templates/${t.id}`} style={{ fontWeight: 700 }}>{t.name}</Link> : <span className="muted">{t.name}</span>}</td>
                    <td>{t.count}</td>
                    <td>{Math.round(t.views / t.count).toLocaleString()}</td>
                    <td>{t.retention === null ? '-' : `${t.retention}%`}</td>
                    <td>{t.views === 0 ? '-' : `${((t.likes / t.views) * 100).toFixed(1)}%`}</td>
                    <td>{t.views.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="muted">視聴維持率は再生数で重み付けした平均、いいね率は いいね ÷ 再生数 です。</p>
      </section>

      <section>
        <h2>動画ごとの数字</h2>
        <div className="card flat">
          {projects.length === 0 ? (
            <div className="empty">まだ数字が入った動画はありません。</div>
          ) : (
            <table>
              <thead>
                <tr><th>動画</th><th>構成案</th><th>再生数</th><th>いいね</th><th>コメント</th><th>視聴維持率</th></tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const sum = (k: 'views' | 'likes' | 'comments') => p.analytics.reduce((acc, a) => acc + a[k], 0);
                  const retention = weightedRetention(p.analytics);
                  return (
                    <tr key={p.id}>
                      <td><Link href={`/projects/${p.id}`} style={{ fontWeight: 700 }}>{p.title}</Link></td>
                      <td className="muted">{p.template?.name ?? '-'}</td>
                      <td>{sum('views').toLocaleString()}</td>
                      <td>{sum('likes').toLocaleString()}</td>
                      <td>{sum('comments').toLocaleString()}</td>
                      <td>{retention === null ? '-' : `${retention}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2>知見</h2>
        <p className="lead" style={{ marginBottom: 12 }}>実測の数字から作った知見です。エージェントは次の台本を作るときに参考にします。</p>
        <div className="card flat list">
          {knowledge.length === 0 ? (
            <div className="empty" style={{ display: 'block' }}>まだ知見はありません（再生数1,000回以上の動画から作られます）。</div>
          ) : (
            knowledge.map((k) => (
              <div key={k.id}>
                <div className="grow">{k.ruleText}</div>
                <span className="muted">信頼度 {Math.round(k.confidenceScore * 100)}%</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

type ProjectWithMetrics = {
  template: { id: string; name: string } | null;
  analytics: { views: number; likes: number; retentionRate: number | null }[];
};

// 構成案ごとに、本数・再生数・いいね・視聴維持率（再生数で重み付け）をまとめる。1本あたりの再生数が多い順
function compareTemplates(projects: ProjectWithMetrics[]) {
  const groups = new Map<string | null, { id: string | null; name: string; count: number; views: number; likes: number; metrics: ProjectWithMetrics['analytics'] }>();
  for (const p of projects) {
    const key = p.template?.id ?? null;
    const g = groups.get(key) ?? { id: key, name: p.template?.name ?? '（記録なし）', count: 0, views: 0, likes: 0, metrics: [] };
    g.count += 1;
    g.views += p.analytics.reduce((acc, a) => acc + a.views, 0);
    g.likes += p.analytics.reduce((acc, a) => acc + a.likes, 0);
    g.metrics.push(...p.analytics);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, retention: weightedRetention(g.metrics) }))
    .sort((a, b) => b.views / b.count - a.views / a.count);
}
