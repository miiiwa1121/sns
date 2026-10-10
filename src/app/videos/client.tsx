'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';

export type VideoRow = {
  id: string;
  title: string;
  createdAt: string; // ISO
  durationSec: number;
  status: string;
  statusClass: string;
  templateName: string | null;
  views: number | null; // 数字が未入力なら null
  likes: number | null;
  comments: number | null;
  retention: number | null;
  youtubeUrl: string | null;
  videoUrl: string | null; // 整理で消した動画は null
  posterUrl: string | null;
};

// ---------- 縦型で見る（1本ずつ上下にスクロール。画面に入った動画だけを自動再生する） ----------

export function VideoFeed({ rows }: { rows: VideoRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const videos = Array.from(container.current?.querySelectorAll('video') ?? []);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const video = e.target as HTMLVideoElement;
          // 自動再生はミュートが条件（ブラウザの制限）。音はプレーヤーで出す
          if (e.isIntersecting) video.play().catch(() => {});
          else video.pause();
        }
      },
      { root: container.current, threshold: 0.6 }
    );
    videos.forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [rows]);

  return (
    <div className="video-feed" ref={container}>
      {rows.map((r) => (
        <div key={r.id} className="feed-item">
          {r.videoUrl ? (
            <video src={r.videoUrl} poster={r.posterUrl ?? undefined} preload="metadata" muted loop playsInline controls />
          ) : (
            <div className="feed-missing muted">動画ファイルは整理で削除済みです</div>
          )}
          <div className="feed-info stack" style={{ gap: 6 }}>
            <span className={`badge ${r.statusClass}`} style={{ alignSelf: 'flex-start' }}>{r.status}</span>
            <Link href={`/projects/${r.id}`} className="title">{r.title}</Link>
            <span className="muted">
              {new Date(r.createdAt).toLocaleDateString('ja-JP')} ・ {r.durationSec}秒
              {r.views !== null && ` ・ ${r.views.toLocaleString()} 回再生`}
              {r.retention !== null && ` ・ 視聴維持率 ${r.retention}%`}
            </span>
            {r.templateName && <span className="muted">構成案: {r.templateName}</span>}
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

// ---------- 一覧表（見出しを押すと並べ替え） ----------

type SortKey = 'title' | 'createdAt' | 'durationSec' | 'status' | 'templateName' | 'views' | 'likes' | 'comments' | 'retention';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'title', label: 'タイトル' },
  { key: 'createdAt', label: '作成日' },
  { key: 'durationSec', label: '尺', numeric: true },
  { key: 'status', label: '状態' },
  { key: 'templateName', label: '構成案' },
  { key: 'views', label: '再生数', numeric: true },
  { key: 'likes', label: 'いいね', numeric: true },
  { key: 'comments', label: 'コメント', numeric: true },
  { key: 'retention', label: '視聴維持率', numeric: true },
];

export function VideoTable({ rows }: { rows: VideoRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'createdAt', desc: true });
  const sorted = useMemo(() => {
    const value = (r: VideoRow) => r[sort.key];
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      // 空欄（数字が未入力など）は並び順に関わらず最後
      if (va === null) return vb === null ? 0 : 1;
      if (vb === null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ja');
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'title' && key !== 'status' && key !== 'templateName' }));
  const num = (v: number | null, suffix = '') => (v === null ? '' : `${v.toLocaleString()}${suffix}`);

  return (
    <div className="card flat sheet-wrap">
      <table className="sheet">
        <thead>
          <tr>
            <th aria-label="サムネイル" />
            {COLUMNS.map((c) => (
              <th key={c.key} className={c.numeric ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                <button type="button" onClick={() => toggle(c.key)}>
                  {c.label}
                  {sort.key === c.key && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              {/* サムネは /api/media の小さな JPEG をそのまま出す（画像最適化を通すほどではない） */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <td>{r.posterUrl ? <img src={r.posterUrl} alt="" className="sheet-thumb" loading="lazy" /> : null}</td>
              <td className="wrap">
                <Link href={`/projects/${r.id}`} style={{ fontWeight: 700 }}>{r.title}</Link>
                {r.youtubeUrl && (
                  <a href={r.youtubeUrl} target="_blank" rel="noreferrer" aria-label="YouTube で見る" title="YouTube で見る" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                    <ExternalLink size={13} />
                  </a>
                )}
              </td>
              <td>{new Date(r.createdAt).toLocaleDateString('ja-JP')}</td>
              <td className="num">{r.durationSec}秒</td>
              <td><span className={`badge ${r.statusClass}`}>{r.status}</span></td>
              <td>{r.templateName ?? ''}</td>
              <td className="num">{num(r.views)}</td>
              <td className="num">{num(r.likes)}</td>
              <td className="num">{num(r.comments)}</td>
              <td className="num">{num(r.retention, '%')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
