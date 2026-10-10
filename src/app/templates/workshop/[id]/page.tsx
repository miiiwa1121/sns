import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import type { SampleScript } from '@/lib/services/workshopService';
import {
  deleteWorkshop,
  requestWorkshopSample,
  saveWorkshopAsTemplate,
  saveWorkshopDraft,
  sendWorkshopChat,
} from '../../../actions';
import { AutoRefresh } from '../../../jobs/[id]/client';
import { ChatForm, DraftForm, SamplePreview, SampleTopicForm, WorkshopHeader } from './client';
import { ChatScroll, ResizableColumns } from './columns';

// 構成案を AI と相談しながら作る画面。ヘッダー: 名前・戻る・試作する・保存・削除 / 左: 試作の話題と下書き / 中央: 試作のプレビュー / 右: 相談（列の幅は境目のドラッグで変えられる）
export default async function WorkshopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sample?: string }>;
}) {
  const { id } = await params;
  const { sample: sampleId } = await searchParams;
  const workshop = await prisma.templateWorkshop.findUnique({
    where: { id },
    include: {
      account: { include: { platformConnections: true, trendResearches: { orderBy: { createdAt: 'desc' }, take: 20 } } },
      baseTemplate: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!workshop) notFound();

  const busy = workshop.messages.some((m) => m.status === 'pending');
  const samples = workshop.messages.filter((m) => m.kind === 'sample' && m.role === 'assistant' && m.status === 'done' && m.sampleJson);
  const shown = samples.find((m) => m.id === sampleId) ?? samples[samples.length - 1];
  const script = shown ? safeJson<SampleScript>(shown.sampleJson, { title: '', lines: [] }) : null;
  const handle = workshop.account.platformConnections.find((c) => c.platform === 'youtube')?.handle ?? '';

  return (
    <div className="page full-page">
      <AutoRefresh active={busy} interval={2000} />
      <WorkshopHeader
        name={workshop.name}
        busy={busy}
        baseTemplateName={workshop.baseTemplate?.name ?? null}
        savedTemplateId={workshop.savedTemplateId}
        saveOverwrite={workshop.baseTemplate ? saveWorkshopAsTemplate.bind(null, workshop.id, true) : null}
        saveNew={saveWorkshopAsTemplate.bind(null, workshop.id, false)}
        remove={deleteWorkshop.bind(null, workshop.id)}
      />

      <ResizableColumns
        left={
          <>
            <section className="card stack" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>試作の話題</h2>
              <SampleTopicForm action={requestWorkshopSample.bind(null, workshop.id)} topics={workshop.account.trendResearches.map((r) => r.topic)} />
            </section>
            <section className="card stack" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>構成案の下書き</h2>
              <DraftForm key={workshop.updatedAt.toISOString()} action={saveWorkshopDraft.bind(null, workshop.id)} values={workshop} />
            </section>
            <p className="muted">{workshop.account.name} の動画として相談しています（コンセプト・視聴者・話し方を前提にします）。</p>
          </>
        }
        center={
          <section className="card ws-center-card">
            {script && shown ? (
              <SamplePreview
                title={script.title}
                lines={script.lines}
                topic={shown.sampleTopic}
                brandName={workshop.account.name}
                handle={handle}
                samples={samples.map((m, i) => ({
                  id: m.id,
                  label: `試作 ${i + 1}`,
                  href: `/templates/workshop/${workshop.id}?sample=${m.id}`,
                  active: m.id === shown.id,
                }))}
              />
            ) : (
              <div className="empty">
                {busy ? 'AI が作業しています…' : 'まだ試作はありません。左で話題を選んで、ヘッダーの「試作する」を押してください。'}
              </div>
            )}
          </section>
        }
        right={
          <section className="card ws-chat-card">
            <h2 style={{ margin: 0 }}>相談</h2>
            {/* 発言の件数と状態が変わったら（返事が届いたら）下までスクロールする */}
            <ChatScroll count={workshop.messages.map((m) => `${m.id}:${m.status}`).join(',')}>
              {workshop.messages.length === 0 && (
                <p className="muted">どんな動画にしたいかを伝えてください。AI が構成案（左の下書き）を直します。試作すると、その構成案で台本を1本書いて中央に映像で見せます。</p>
              )}
              {workshop.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  {m.status === 'pending' && <span className="muted">{m.kind === 'sample' ? '試作しています…（30秒ほど）' : '考えています…'}</span>}
                  {m.status === 'failed' && <span className="notice ng">うまくいきませんでした: {m.error}</span>}
                  {m.status === 'done' && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                  {m.proposedBody && (
                    <details style={{ marginTop: 6 }}>
                      <summary className="muted" style={{ cursor: 'pointer' }}>構成案を直しました（内容を見る）</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 6 }}>{m.proposedBody}</pre>
                    </details>
                  )}
                  {m.kind === 'sample' && m.role === 'assistant' && m.status === 'done' && (
                    <div style={{ marginTop: 6 }}>
                      {shown?.id === m.id ? (
                        <span className="badge you">中央に表示中</span>
                      ) : (
                        <Link href={`/templates/workshop/${workshop.id}?sample=${m.id}`} className="btn" scroll={false}>この試作を見る</Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </ChatScroll>
            <ChatForm action={sendWorkshopChat.bind(null, workshop.id)} disabled={busy} />
          </section>
        }
      />
    </div>
  );
}
