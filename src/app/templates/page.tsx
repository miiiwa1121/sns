import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { listTemplates } from '@/lib/services/templateService';
import { startTemplateWorkshop } from '../actions';

// 動画の構成案の一覧（全アカウント共通）
export default async function TemplatesPage() {
  const templates = await listTemplates();
  const counts = await prisma.structureTemplate.findMany({
    select: { id: true, accounts: { select: { name: true } }, _count: { select: { projects: true } } },
  });
  const usage = new Map(counts.map((c) => [c.id, c]));

  return (
    <div className="page">
      <div className="row between">
        <h1>構成案</h1>
        <div className="row" style={{ gap: 8 }}>
          <form action={startTemplateWorkshop.bind(null, null)}>
            <button className="btn primary">AI と相談して作る</button>
          </form>
          <Link href="/templates/new" className="btn">自分で書いて追加</Link>
        </div>
      </div>
      <p className="lead">
        AI が台本を組み立てるときの「型」です。尺・流れ・場面の使い方を決めます。アカウントごとに既定の構成案を選び、依頼するときに選び直すこともできます。
      </p>
      <div className="card flat list">
        {templates.map((t) => {
          const u = usage.get(t.id);
          return (
            <Link key={t.id} href={`/templates/${t.id}`}>
              <div className="grow stack" style={{ gap: 4 }}>
                <span className="title">{t.name}</span>
                {t.description && <span className="muted">{t.description}</span>}
              </div>
              <div className="side">
                {u && u.accounts.length > 0 && <span className="badge">既定: {u.accounts.map((a) => a.name).join('、')}</span>}
                <span className="muted">企画 {u?._count.projects ?? 0} 件</span>
              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
