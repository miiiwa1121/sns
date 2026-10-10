import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// 選択中のチャンネル（Account）は cookie に slug で持つ。未選択・不正なら最初のチャンネル
export const CHANNEL_COOKIE = 'channel';

export async function listChannels() {
  return prisma.account.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
}

export async function getCurrentChannel() {
  const slug = (await cookies()).get(CHANNEL_COOKIE)?.value;
  const channels = await listChannels();
  return channels.find((c) => c.slug === slug) ?? channels[0] ?? null;
}
