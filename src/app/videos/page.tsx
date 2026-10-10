import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentChannel } from '@/lib/channel';
import { NoChannel } from '../ui';
import { mediaExists, mediaUrlPath, thumbRelPath } from '@/lib/storage';

// 作った動画の一覧（選択中のアカウント）
export default async function VideosPage() {
  const channel = await getCurrentChannel();
  if (!channel) return <div className="page"><h1>動画</h1><NoChannel /></div>;
  const projects = await prisma.project.findMany({
    where: { accountId: channel.id, shortClips: { some: { renderedFilePath: { not: null } } } },
    include: { shortClips: true, publishLogs: true, analytics: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="page">
      <h1>動画</h1>
      {projects.length === 0 && <div className="card empty">まだ動画はありません。</div>}
      <div className="video-grid">
        {projects.map((p) => {
          const clip = p.shortClips[0];
          const yt = p.publishLogs.find((l) => l.platform === 'youtube' && l.status === 'published');
          const views = p.analytics.find((a) => a.platform === 'youtube')?.views;
          const status = yt ? { label: 'YouTube 投稿済み', cls: 'ok' } : clip.readyToPublish ? { label: '承認済み', cls: '' } : { label: '承認待ち', cls: 'you' };
          return (
            <div key={p.id} className="card video-card">
              {mediaExists(clip.renderedFilePath!) ? (
                <video src={mediaUrlPath(clip.renderedFilePath!)} poster={mediaUrlPath(thumbRelPath(clip.renderedFilePath!))} preload="none" controls />
              ) : (
                <div className="muted">動画ファイルは整理（clean）で削除済みです</div>
              )}
              <div className="stack" style={{ gap: 6 }}>
                <span className={`badge ${status.cls}`} style={{ alignSelf: 'flex-start' }}>{status.label}</span>
                <Link href={`/projects/${p.id}`} className="title">{p.title}</Link>
                <span className="muted">
                  {p.createdAt.toLocaleDateString('ja-JP')} ・ {clip.durationSec}秒{views !== undefined && ` ・ ${views.toLocaleString()} 回再生`}
                </span>
                {yt?.postUrl && (
                  <a href={yt.postUrl} target="_blank" rel="noreferrer" className="row muted" style={{ gap: 4 }}>
                    YouTube で見る <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
