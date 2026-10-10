export type PlatformType = 'youtube' | 'tiktok' | 'instagram' | 'x';

export const PLATFORM_LABEL: Record<PlatformType, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  x: 'X',
};

// 管理画面で扱う投稿先。2026-10-10 から当面は YouTube のみで検証する（Decision 012）。データ上は4媒体のまま
export const ENABLED_PLATFORMS: PlatformType[] = ['youtube'];
