import { prisma } from '@/lib/prisma';

// アカウント（Account）の一覧。画面全体でアカウントを選ぶ仕組みはない（2026-10-11 に廃止）。
// どのアカウントの動画を作るかは、依頼のときに選ぶ
export async function listChannels() {
  return prisma.account.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
}

// 指示書の見本や、構成案の相談の前提に使うアカウント（一覧の先頭）
export async function firstChannel() {
  return (await listChannels())[0] ?? null;
}
