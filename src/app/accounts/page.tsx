import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentChannel } from '@/lib/channel';
import { safeJson } from '@/lib/json';

export default async function AccountsPage() {
  const [accounts, current] = await Promise.all([
    prisma.account.findMany({
      where: { isActive: true },
      include: { platformConnections: true, _count: { select: { projects: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    getCurrentChannel(),
  ]);

  return (
    <div className="page">
      <div className="row between">
        <h1>アカウント</h1>
        <Link href="/accounts/new" className="btn primary">アカウントを追加</Link>
      </div>
      <p className="lead">アカウントごとに、コンセプト・話し方・YouTube チャンネル・企画・知見が分かれます。左上の切り替えで、作業するアカウントを選びます。</p>
      <div className="card flat list">
        {accounts.length === 0 && <div className="empty" style={{ display: 'block' }}>まだアカウントがありません。</div>}
        {accounts.map((a) => {
          const yt = a.platformConnections.find((c) => c.platform === 'youtube');
          const channel = safeJson<{ channelTitle?: string }>(yt?.apiConfig, {});
          return (
            <Link key={a.id} href={`/accounts/${a.slug}`}>
              <div className="grow stack" style={{ gap: 4 }}>
                <span className="title">{a.name}{a.id === current?.id && <span className="badge you" style={{ marginLeft: 8 }}>選択中</span>}</span>
                <span className="muted">{a.slug} ・ 企画 {a._count.projects} 件</span>
              </div>
              <div className="side">
                {yt?.isConnected ? <span className="badge ok">YouTube 連携済み</span> : <span className="badge">YouTube 未連携</span>}
                {channel.channelTitle && <span className="muted">{channel.channelTitle}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
