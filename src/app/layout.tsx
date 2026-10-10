import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Shell, ChannelSwitcher } from './Shell';
import { listChannels, getCurrentChannel } from '@/lib/channel';
import { loadYourTurn } from '@/lib/queries';
import { loadRunningJobs } from '@/lib/jobs';

export const metadata: Metadata = {
  title: 'OmniPulse Studio',
  description: 'ショート動画のリサーチ・制作・承認・配信・分析を、エージェントと分担して回す管理画面',
};

// 保存済みの配色、なければ OS の設定を、描画前に <html data-theme> へ反映する（ちらつき防止）
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

// Cache Components 有効のため、cookie と DB を読む部分は <Suspense> の内側に置く（骨組みだけ先に表示される）
async function ChannelSlot() {
  const [channels, current] = await Promise.all([listChannels(), getCurrentChannel()]);
  if (channels.length === 0) return null;
  return <ChannelSwitcher channels={channels.map((c) => ({ slug: c.slug, name: c.name }))} currentSlug={current?.slug ?? null} />;
}

async function YourTurnCount() {
  const { now } = await loadYourTurn();
  return now.length > 0 ? <span className="count">{now.length}</span> : null;
}

async function RunningJobCount() {
  const running = await loadRunningJobs();
  return running.length > 0 ? <span className="count">{running.length}</span> : null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <Shell
          channelSlot={<Suspense fallback={null}><ChannelSlot /></Suspense>}
          homeBadge={<Suspense fallback={null}><YourTurnCount /></Suspense>}
          activityBadge={<Suspense fallback={null}><RunningJobCount /></Suspense>}
        >
          <Suspense fallback={<p className="muted">読み込み中…</p>}>{children}</Suspense>
        </Shell>
      </body>
    </html>
  );
}
