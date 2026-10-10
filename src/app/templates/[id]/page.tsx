import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { firstChannel } from '@/lib/channel';
import { previewJobPrompts } from '@/lib/jobPromptPreview';
import { deleteTemplate, startTemplateWorkshop, updateTemplate } from '../../actions';
import { ActionButton } from '../../projects/[id]/client';
import { TemplateForm } from '../TemplateForm';

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.structureTemplate.findUnique({
    where: { id },
    include: { accounts: { select: { name: true, slug: true } }, _count: { select: { projects: true, ownedWorkshops: true } } },
  });
  if (!template) notFound();
  const channel = await firstChannel();

  // 実際に AI に渡す指示書の見本（一覧の先頭のアカウント・お題おまかせ）。パスなどは見本の値
  const preview = channel ? (await previewJobPrompts(channel, { template })).script : null;

  return (
    <div className="page">
      <Link href="/templates" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />構成案一覧</Link>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1>{template.name}</h1>
        <form action={startTemplateWorkshop.bind(null, template.id)}>
          {/* 相談から生まれた構成案は、その相談を開き直す。それ以外は複製を作って相談する */}
          <button className="btn primary">{template._count.ownedWorkshops > 0 ? 'AI との相談を開く' : 'AI と相談して改善する（複製を作る）'}</button>
        </form>
      </div>
      <p className="muted">
        既定にしているアカウント: {template.accounts.length > 0 ? template.accounts.map((a) => a.name).join('、') : 'なし'} ・ この構成案で作った企画 {template._count.projects} 件
      </p>

      <TemplateForm action={updateTemplate.bind(null, template.id)} values={template} />
      <p className="muted">保存すると、これからの依頼に使われます。作成済みの企画や、作業中の依頼には影響しません。</p>

      {preview && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>台本の工程で AI に渡す指示書（見本: {channel?.name}）</summary>
          <p className="muted" style={{ marginTop: 8 }}>「構成案」の節に、上の構成の指示が入ります。リサーチの結果は依頼のたびにリサーチの工程で決まります。禁止事項は最初から選んだ状態のもので、書き方の決まりは固定です。保存前の内容は反映されません。</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 8 }}>{preview}</pre>
        </details>
      )}

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>削除</h2>
        <p className="muted">アカウントの既定になっている構成案は削除できません。削除しても、これまでの依頼に使った内容の記録は残ります。</p>
        <ActionButton action={deleteTemplate.bind(null, template.id)} label="この構成案を削除する" pendingLabel="削除中…" confirm={`「${template.name}」を削除します。よろしいですか？`} />
      </section>
    </div>
  );
}
