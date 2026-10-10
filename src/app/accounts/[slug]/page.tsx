import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import { YouTubePublisher } from '@/lib/publishers/youtubePublisher';
import { updateAccount } from '../../actions';
import { AccountForm } from '../AccountForm';

export default async function AccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const account = await prisma.account.findUnique({ where: { slug }, include: { platformConnections: true } });
  if (!account) notFound();
  const yt = account.platformConnections.find((c) => c.platform === 'youtube');
  const channel = safeJson<{ channelId?: string; channelTitle?: string }>(yt?.apiConfig, {});
  const tokenReady = YouTubePublisher.getAuthorizedClient(account.slug) !== null;
  const connected = Boolean(channel.channelId && tokenReady);

  return (
    <div className="page">
      <Link href="/accounts" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />アカウント一覧</Link>
      <h1>{account.name}</h1>

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>YouTube 連携</h2>
        {connected ? (
          <p><span className="badge ok">連携済み</span> {channel.channelTitle}（{channel.channelId}）</p>
        ) : (
          <>
            <p><span className="badge">未連携</span> このアカウントの動画は YouTube に投稿できません。</p>
            <p className="muted">ターミナルで次を実行し、ブラウザでこのアカウントの YouTube チャンネルを選んで許可してください（手順: docs/operations/youtube-setup.md）。</p>
            <pre className="input" style={{ whiteSpace: 'pre-wrap' }}>npm run youtube:auth -- {account.slug}</pre>
          </>
        )}
        <p className="muted">投稿の直前に、認証先のチャンネルがここに登録したチャンネルと同じか確認し、違えば投稿しません。</p>
      </section>

      <section>
        <h2>設定</h2>
        <AccountForm
          action={updateAccount.bind(null, account.id)}
          values={{ ...account, youtubeHandle: yt?.handle ?? '' }}
        />
      </section>
    </div>
  );
}
