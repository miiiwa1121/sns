'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 作業中は一定間隔で画面を取り直す
export function AutoRefresh({ active, interval = 3000 }: { active: boolean; interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), interval);
    return () => clearInterval(t);
  }, [active, interval, router]);
  return null;
}
