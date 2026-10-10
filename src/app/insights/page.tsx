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
      include: { analytics: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.agentKnowledge.findMany({ where: { accountId: channel.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="page">
      <h1>分析・知見</h1>

      <section>
        <h2>動画ごとの数字</h2>
        <div className="card flat">
          {projects.length === 0 ? (
            <div className="empty">まだ数字が入った動画はありません。</div>
          ) : (
            <table>
              <thead>
                <tr><th>動画</th><th>再生数</th><th>いいね</th><th>コメント</th><th>視聴維持率</th></tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const sum = (k: 'views' | 'likes' | 'comments') => p.analytics.reduce((acc, a) => acc + a[k], 0);
                  const retention = weightedRetention(p.analytics);
                  return (
                    <tr key={p.id}>
                      <td><Link href={`/projects/${p.id}`} style={{ fontWeight: 700 }}>{p.title}</Link></td>
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
