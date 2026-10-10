'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Activity, BookOpen, Bot, ChartColumn, Clapperboard, Film, House, LayoutTemplate, Menu, Moon, Plus, Search, Settings, Sun, UserRound } from 'lucide-react';
import { selectChannel } from './actions';

const NAV = [
  { href: '/', label: 'ホーム', icon: House },
  { href: '/new', label: '新しい動画を作る', icon: Plus },
  { href: '/activity', label: '作業状況', icon: Activity },
  { href: '/videos', label: '動画', icon: Clapperboard },
  { href: '/projects', label: '企画', icon: Film },
  { href: '/research', label: 'リサーチ', icon: Search },
  { href: '/insights', label: '分析・知見', icon: ChartColumn },
];
const NAV_SUB = [
  { href: '/accounts', label: 'アカウント', icon: UserRound },
  { href: '/templates', label: '構成案', icon: LayoutTemplate },
];
// サイドバーの一番下に置く
const NAV_BOTTOM = [
  { href: '/ai', label: 'AI 連携', icon: Bot },
  { href: '/settings', label: '設定', icon: Settings },
  { href: '/guide', label: '使い方', icon: BookOpen },
];

const MOBILE = 860;

type Badges = { homeBadge: React.ReactNode; activityBadge: React.ReactNode };

export function Shell({
  channelSlot,
  homeBadge,
  activityBadge,
  children,
}: Badges & {
  channelSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const closeOnMobile = () => {
    if (window.innerWidth < MOBILE) setOpen(false);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn" aria-label="メニューを開閉" onClick={() => setOpen((v) => !v)}>
          <Menu size={18} />
        </button>
        <span className="brand">OmniPulse Studio</span>
        <span className="spacer" />
        <ThemeToggle />
      </header>

      <nav className={`sidebar${open ? '' : ' closed'}`}>
        {channelSlot}
        {/* usePathname は Cache Components では <Suspense> が必要。読み込み中は現在地の強調なしで出す */}
        <Suspense fallback={<NavLinks homeBadge={homeBadge} activityBadge={activityBadge} pathname={null} />}>
          <CurrentNavLinks homeBadge={homeBadge} activityBadge={activityBadge} onNavigate={closeOnMobile} />
        </Suspense>
      </nav>
      <div className={`overlay${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <main className={`main${open ? '' : ' wide'}`}>{children}</main>
    </div>
  );
}

function CurrentNavLinks({ onNavigate, ...badges }: Badges & { onNavigate: () => void }) {
  const pathname = usePathname();
  // スマホ幅では、画面を移動したらメニューを閉じる（初回表示時も閉じた状態にする）
  useEffect(() => {
    onNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return <NavLinks {...badges} pathname={pathname} />;
}

function NavLinks({ homeBadge, activityBadge, pathname }: Badges & { pathname: string | null }) {
  const isActive = (href: string) => pathname !== null && (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const link = ({ href, label, icon: Icon }: (typeof NAV)[number]) => (
    <Link key={href} href={href} className={`nav-link${isActive(href) ? ' active' : ''}`}>
      <Icon size={18} />
      <span>{label}</span>
      {href === '/' && homeBadge}
      {href === '/activity' && activityBadge}
    </Link>
  );
  return (
    <>
      {NAV.map(link)}
      <div className="section">{NAV_SUB.map(link)}</div>
      <div className="section bottom">{NAV_BOTTOM.map(link)}</div>
    </>
  );
}

// アカウント切り替え。選ぶとすぐ cookie に保存して画面を更新する
export function ChannelSwitcher({ channels, currentSlug }: { channels: { slug: string; name: string }[]; currentSlug: string | null }) {
  return (
    <form action={selectChannel}>
      <select
        name="slug"
        className="channel-select"
        aria-label="アカウント"
        defaultValue={currentSlug ?? undefined}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {channels.map((c) => (
          <option key={c.slug} value={c.slug}>{c.name}</option>
        ))}
      </select>
    </form>
  );
}

// 配色の切り替え。選択は localStorage に保存し、<html data-theme> に反映する（初期値は layout の inline script が OS 設定から決める）。
// 表示するアイコンは CSS で data-theme に合わせて出し分ける
function ThemeToggle() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // プライベートブラウズ等で保存できなくても切り替え自体は効く
    }
  };
  return (
    <button className="icon-btn" aria-label="配色を切り替え" onClick={toggle}>
      <Moon size={18} className="when-light" />
      <Sun size={18} className="when-dark" />
    </button>
  );
}
