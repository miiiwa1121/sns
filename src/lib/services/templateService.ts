import { prisma } from '@/lib/prisma';

/**
 * 動画の構成案（指示書のうち「構成」の部分）。管理画面の「構成案」で編集し、アカウントごとに既定を選ぶ。
 * コマンド・手順・禁止事項は agent/job-prompt.ts に固定で、構成案からは変えられない。
 */

// 構成案が1件もないときに作る既定（2026-10-10 時点の指示書の構成部分と同じ内容）
export const DEFAULT_TEMPLATE = {
  name: '標準（30〜50秒）',
  description: 'フックで始めて締めで終わる、30〜50秒のショート。話題を1つ紹介する基本の型',
  body: [
    '- 尺は 30〜50 秒（1行 2〜5 秒、8〜14 行）。',
    '- 1行目は `hook` 場面で、手を止めさせる一言にする。',
    '- 最後の行は `outro` にする。',
  ].join('\n'),
};

export const TEMPLATE_LIMITS = { name: 60, description: 200, body: 4000 };

/** 構成案の一覧。1件もなければ既定を作り、既定が未設定のアカウントに割り当てる */
export async function listTemplates() {
  let templates = await prisma.structureTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  if (templates.length === 0) {
    const created = await prisma.structureTemplate.create({ data: DEFAULT_TEMPLATE });
    await prisma.account.updateMany({ where: { defaultTemplateId: null }, data: { defaultTemplateId: created.id } });
    templates = [created];
  }
  return templates;
}

/** アカウントの既定の構成案。未設定（または削除済み）なら一覧の先頭 */
export async function defaultTemplateFor(account: { defaultTemplateId: string | null }) {
  const templates = await listTemplates();
  return templates.find((t) => t.id === account.defaultTemplateId) ?? templates[0];
}

export function validateTemplate(f: { name: string; description: string; body: string }): string | null {
  if (!f.name) return '名前を入力してください';
  if (f.name.length > TEMPLATE_LIMITS.name) return `名前は ${TEMPLATE_LIMITS.name} 字以内にしてください`;
  if (f.description.length > TEMPLATE_LIMITS.description) return `説明は ${TEMPLATE_LIMITS.description} 字以内にしてください`;
  if (!f.body) return '構成の指示を入力してください';
  if (f.body.length > TEMPLATE_LIMITS.body) return `構成の指示は ${TEMPLATE_LIMITS.body} 字以内にしてください`;
  return null;
}
