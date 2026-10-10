import Link from 'next/link';
import { ExternalLink, LayoutGrid, Smartphone, Table } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { weightedRetention } from '@/lib/agents/performanceDiagnosis';
import { mediaExists, mediaUrlPath, thumbRelPath } from '@/lib/storage';
import { VideoFeed, VideoTable, type VideoRow } from './client';

// 表示の切り替え（URL の ?view= で持つ）。feed: 縦型で1本ずつ視聴 / grid: カード / table: 表計算のような一覧
const VIEWS = [
  { key: 'feed', label: '縦型で見る', icon: Smartphone },
  { key: 'grid', label: 'カード', icon: LayoutGrid },
  { key: 'table', label: '一覧表', icon: Table },
] as const;
type View = (typeof VIEWS)[number]['key'];

// 作った動画の一覧（全アカウント）
export default async function VideosPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: requested } = await searchParams;
  const view: View = VIEWS.some((v) => v.key === requested) ? (requested as View) : 'grid';

  const projects = await prisma.project.findMany({
    where: { shortClips: { some: { renderedFilePath: { not: null } } } },
    include: { account: { select: { name: true } }, shortClips: true, publishLogs: true, analytics: true, template: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const rows: VideoRow[] = projects.map((p) => {
    const clip = p.shortClips[0];
    const rel = clip.renderedFilePath!;
    const exists = mediaExists(rel);
    const yt = p.publishLogs.find((l) => l.platform === 'youtube' && l.status === 'published');
    const sum = (k: 'views' | 'likes' | 'comments') => (p.analytics.length === 0 ? null : p.analytics.reduce((acc, a) => acc + a[k], 0));
    const status = yt ? { label: 'YouTube 投稿済み', cls: 'ok' } : clip.readyToPublish ? { label: '承認済み', cls: '' } : { label: '承認待ち', cls: 'you' };
    return {
      id: p.id,
      title: p.title,
      accountName: p.account.name,
      createdAt: p.createdAt.toISOString(),
      durationSec: clip.durationSec,
      status: status.label,
      statusClass: status.cls,
      templateName: p.template?.name ?? null,
      views: sum('views'),
      likes: sum('likes'),
      comments: sum('comments'),
      retention: weightedRetention(p.analytics),
      youtubeUrl: yt?.postUrl ?? null,
      videoUrl: exists ? mediaUrlPath(rel) : null,
      posterUrl: exists ? mediaUrlPath(thumbRelPath(rel)) : null,
    };
  });

  return (
    <div className="page">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1>動画</h1>
        <div className="seg" role="tablist" aria-label="表示の切り替え">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={`/videos?view=${key}`} role="tab" aria-selected={view === key} aria-label={label} title={label} className={view === key ? 'active' : ''}>
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
      {rows.length === 0 && <div className="card empty">まだ動画はありません。</div>}
      {rows.length > 0 && view === 'feed' && <VideoFeed rows={rows} />}
      {rows.length > 0 && view === 'table' && <VideoTable rows={rows} />}
      {rows.length > 0 && view === 'grid' && <VideoGrid rows={rows} />}
    </div>
  );
}

function VideoGrid({ rows }: { rows: VideoRow[] }) {
  return (
    <div className="video-grid">
      {rows.map((r) => (
        <div key={r.id} className="card video-card">
          {r.videoUrl ? (
            <video src={r.videoUrl} poster={r.posterUrl ?? undefined} preload="none" controls />
          ) : (
            <div className="muted">動画ファイルは整理で削除済みです</div>
          )}
          <div className="stack" style={{ gap: 6 }}>
            <span className={`badge ${r.statusClass}`} style={{ alignSelf: 'flex-start' }}>{r.status}</span>
            <Link href={`/projects/${r.id}`} className="title">{r.title}</Link>
            <span className="muted">
              {r.accountName} ・ {new Date(r.createdAt).toLocaleDateString('ja-JP')} ・ {r.durationSec}秒{r.views !== null && ` ・ ${r.views.toLocaleString()} 回再生`}
            </span>
            {r.youtubeUrl && (
              <a href={r.youtubeUrl} target="_blank" rel="noreferrer" className="row muted" style={{ gap: 4 }}>
                YouTube で見る <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
