import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { firstChannel } from '@/lib/channel';
import { previewJobPrompts } from '@/lib/jobPromptPreview';
import { deleteResearchMethod, updateResearchMethod } from '../../actions';
import { ActionButton } from '../../projects/[id]/client';
import { ResearchMethodForm } from '../ResearchMethodForm';

export default async function ResearchMethodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const method = await prisma.researchMethod.findUnique({
    where: { id },
    include: { accounts: { select: { name: true } }, _count: { select: { jobs: true } } },
  });
  if (!method) notFound();
  const channel = await firstChannel();
  const preview = channel ? (await previewJobPrompts(channel, { researchMethod: method })).research : null;

  return (
    <div className="page">
      <Link href="/research-methods" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />リサーチ手法一覧</Link>
      <h1>{method.name}</h1>
      <p className="muted">
        既定にしているアカウント: {method.accounts.length > 0 ? method.accounts.map((a) => a.name).join('、') : 'なし'} ・ このリサーチ手法で依頼した数 {method._count.jobs} 件
      </p>

      <ResearchMethodForm action={updateResearchMethod.bind(null, method.id)} values={method} />
      <p className="muted">保存すると、これからの依頼に使われます。作業中・作成済みの依頼には影響しません。</p>

      {preview && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>リサーチの工程で AI に渡す指示書（見本: {channel?.name}・お題おまかせ）</summary>
          <p className="muted" style={{ marginTop: 8 }}>「リサーチ手法」の節に、上のリサーチの指示が入ります。禁止事項は最初から選んだ状態のもので、コマンド・手順は固定です。保存前の内容は反映されません。</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 8 }}>{preview}</pre>
        </details>
      )}

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>削除</h2>
        <p className="muted">アカウントの既定になっているリサーチ手法は削除できません。削除しても、これまでの依頼に使った内容の記録は残ります。</p>
        <ActionButton action={deleteResearchMethod.bind(null, method.id)} label="このリサーチ手法を削除する" pendingLabel="削除中…" confirm={`「${method.name}」を削除します。よろしいですか？`} />
      </section>
    </div>
  );
}
