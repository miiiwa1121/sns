import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { listResearchMethods } from '@/lib/services/researchMethodService';

// リサーチ手法の一覧（全アカウント共通）
export default async function ResearchMethodsPage() {
  const methods = await listResearchMethods();
  const counts = await prisma.researchMethod.findMany({
    select: { id: true, accounts: { select: { name: true } }, _count: { select: { jobs: true } } },
  });
  const usage = new Map(counts.map((c) => [c.id, c]));

  return (
    <div className="page">
      <div className="row between">
        <h1>リサーチ手法</h1>
        <Link href="/research-methods/new" className="btn primary">追加する</Link>
      </div>
      <p className="lead">
        AI が話題を探すときの「調べ方」です。対象期間・調べる場所・話題の選び方を決めます。アカウントごとに既定のリサーチ手法を選び、依頼するときに選び直すこともできます。
      </p>
      <div className="card flat list">
        {methods.map((m) => {
          const u = usage.get(m.id);
          return (
            <Link key={m.id} href={`/research-methods/${m.id}`}>
              <div className="grow stack" style={{ gap: 4 }}>
                <span className="title">{m.name}</span>
                {m.description && <span className="muted">{m.description}</span>}
              </div>
              <div className="side">
                {u && u.accounts.length > 0 && <span className="badge">既定: {u.accounts.map((a) => a.name).join('、')}</span>}
                <span className="muted">依頼 {u?._count.jobs ?? 0} 件</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
