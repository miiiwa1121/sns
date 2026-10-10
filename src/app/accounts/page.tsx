import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { platformConnections: true, _count: { select: { projects: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="page">
      <div className="row between">
        <h1>アカウント</h1>
        <Link href="/accounts/new" className="btn primary">アカウントを追加</Link>
      </div>
      <p className="lead">アカウントごとに、コンセプト・視聴者・YouTube チャンネル・企画・知見が分かれます。どのアカウントの動画を作るかは、依頼するときに選びます。</p>
      <div className="card flat list">
        {accounts.length === 0 && <div className="empty" style={{ display: 'block' }}>まだアカウントがありません。</div>}
        {accounts.map((a) => {
          const yt = a.platformConnections.find((c) => c.platform === 'youtube');
          const channel = safeJson<{ channelTitle?: string }>(yt?.apiConfig, {});
          return (
            <Link key={a.id} href={`/accounts/${a.slug}`}>
              <div className="grow stack" style={{ gap: 4 }}>
                <span className="title">{a.name}</span>
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
