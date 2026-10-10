import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
import { ActionButton } from '../../../projects/[id]/client';
import { AutoRefresh } from '../../../jobs/[id]/client';
import { ChatForm, DraftForm, SampleForm, SamplePlayer } from './client';
import { ChatScroll, ResizableColumns } from './columns';

// 構成案を AI と相談しながら作る画面。左: 下書きと保存 / 中央: 試作のプレビューと依頼 / 右: 相談（幅は境目のドラッグで変えられる）
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
      <Link href="/templates" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />構成案一覧</Link>
      <div className="stack" style={{ gap: 4 }}>
        <h1>AI と構成案を作る</h1>
        <p className="muted">
          {workshop.account.name} の動画として相談します ・ {workshop.baseTemplate ? `元にした構成案: ${workshop.baseTemplate.name}` : '新しい構成案'}
        </p>
      </div>

      <ResizableColumns
        left={
          <>
            <section className="card stack" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>構成案の下書き</h2>
              <DraftForm key={workshop.updatedAt.toISOString()} action={saveWorkshopDraft.bind(null, workshop.id)} values={workshop} />
            </section>

            <section className="card stack" style={{ gap: 10 }}>
              <h2 style={{ margin: 0 }}>構成案として保存</h2>
              <p className="muted">保存すると、これからの依頼で選べるようになります。{workshop.savedTemplateId && <> 保存済み: <Link href={`/templates/${workshop.savedTemplateId}`}>構成案を開く</Link></>}</p>
              <div className="stack" style={{ gap: 8 }}>
                {workshop.baseTemplate && (
                  <ActionButton
                    action={saveWorkshopAsTemplate.bind(null, workshop.id, true)}
                    label={`「${workshop.baseTemplate.name}」を上書き保存`}
                    pendingLabel="保存中…"
                    primary
                    confirm={`「${workshop.baseTemplate.name}」をこの下書きで上書きします。この構成案を既定にしているアカウントの、これからの依頼に影響します。よろしいですか？`}
                  />
                )}
                <ActionButton action={saveWorkshopAsTemplate.bind(null, workshop.id, false)} label="新しい構成案として保存" pendingLabel="保存中…" primary={!workshop.baseTemplate} />
              </div>
            </section>

            <ActionButton action={deleteWorkshop.bind(null, workshop.id)} label="この相談を削除する" pendingLabel="削除中…" confirm="この相談（会話と試作）を削除します。保存した構成案は残ります。よろしいですか？" />
          </>
        }
        center={
          <>
            <section className="card stack" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>試作のプレビュー</h2>
              {script ? (
                <>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div className="ws-player">
                      <SamplePlayer title={script.title} lines={script.lines} brandName={workshop.account.name} handle={handle} />
                    </div>
                    <ol className="sample-script">
                      {script.lines.map((l, i) => (
                        <li key={i}>
                          <span className="muted">{l.scene?.type ?? '（継続）'}{l.mood ? ` / ${l.mood}` : ''}</span>
                          <div>{(l.caption ?? l.text).replace(/\n/g, ' ')}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <p className="muted">話題: {shown?.sampleTopic} ・ 各行の長さは文字数からの見積もりです（実際の動画では音声の長さで決まります）。</p>
                </>
              ) : (
                <p className="muted">まだ試作はありません。下の「試作する」から作れます。</p>
              )}
            </section>

            <section className="card stack" style={{ gap: 12 }}>
              <h2 style={{ margin: 0 }}>試作する</h2>
              <p className="muted">今の下書きの構成案で、台本を1本だけ書いて映像で見せます（音声なし）。</p>
              <SampleForm action={requestWorkshopSample.bind(null, workshop.id)} topics={workshop.account.trendResearches.map((r) => r.topic)} disabled={busy} />
            </section>
          </>
        }
        right={
          <section className="card ws-chat-card">
            <h2 style={{ margin: 0 }}>相談</h2>
            {/* 発言の件数と状態が変わったら（返事が届いたら）下までスクロールする */}
            <ChatScroll count={workshop.messages.map((m) => `${m.id}:${m.status}`).join(',')}>
              {workshop.messages.length === 0 && (
                <p className="muted">どんな動画にしたいかを伝えてください。AI が構成案（左の下書き）を直します。試作すると、その構成案で台本を1本書いて映像で見せます。</p>
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
                        <Link href={`/templates/workshop/${workshop.id}?sample=${m.id}`} className="btn">この試作を見る</Link>
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
