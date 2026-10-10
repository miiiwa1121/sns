import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import { YouTubePublisher } from '@/lib/publishers/youtubePublisher';
import { youtubeClientReady } from '@/lib/youtubeAuth';
import { listTemplates } from '@/lib/services/templateService';
import { updateAccount } from '../../actions';
import { AccountForm } from '../AccountForm';

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ youtube?: string; message?: string }>;
}) {
  const { slug } = await params;
  // 連携の結果（/api/youtube/oauth/callback から戻ってきたとき）
  const { youtube: result, message } = await searchParams;
  const account = await prisma.account.findUnique({ where: { slug }, include: { platformConnections: true } });
  if (!account) notFound();
  const yt = account.platformConnections.find((c) => c.platform === 'youtube');
  const channel = safeJson<{ channelId?: string; channelTitle?: string }>(yt?.apiConfig, {});
  const templates = await listTemplates();
  const tokenReady = YouTubePublisher.getAuthorizedClient(account.slug) !== null;
  const connected = Boolean(channel.channelId && tokenReady);

  return (
    <div className="page">
      <Link href="/accounts" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />アカウント一覧</Link>
      <h1>{account.name}</h1>

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>YouTube 連携</h2>
        {result && message && <p className={`notice ${result === 'ok' ? 'ok' : 'ng'}`}>{message}</p>}
        {connected ? (
          <p><span className="badge ok">連携済み</span> {channel.channelTitle}（{channel.channelId}）</p>
        ) : (
          <p><span className="badge">未連携</span> このアカウントの動画は YouTube に投稿できません。</p>
        )}
        {!youtubeClientReady() ? (
          <p className="muted">連携するには、先に<Link href="/settings">「設定」</Link>で YouTube API のクライアント ID とシークレットを保存してください。</p>
        ) : (
          <>
            <div>
              {/* Route Handler へのページ遷移（Google の許可画面に移る）なので Link ではなく a を使う */}
              <a className={`btn${connected ? '' : ' primary'}`} href={`/api/youtube/oauth/start?account=${encodeURIComponent(account.slug)}`}>
                {connected ? 'YouTube と連携し直す' : 'YouTube と連携する'}
              </a>
            </div>
            <p className="muted">
              Google の画面に移ります。<strong>このアカウントの YouTube チャンネル（ブランドアカウント）</strong>を選び、権限のチェックをすべて入れて許可してください。
              「Google はこのアプリを確認していません」と出たら「詳細」→「（アプリ名）に移動」で進みます。
            </p>
          </>
        )}
        <p className="muted">投稿の直前に、認証先のチャンネルがここに登録したチャンネルと同じか確認し、違えば投稿しません。</p>
      </section>

      <section>
        <h2>設定</h2>
        <AccountForm
          action={updateAccount.bind(null, account.id)}
          values={{ ...account, youtubeHandle: yt?.handle ?? '' }}
          templates={templates}
        />
      </section>
    </div>
  );
}
