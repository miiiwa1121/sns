import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import { SYSTEM_PROMPT, promptsForDisplay, workshopContext, type SampleScript } from '@/lib/services/workshopService';
import { buildJobPrompt } from '../../../../../agent/job-prompt';
import {
  deleteWorkshop,
  renameWorkshop,
  requestWorkshopSample,
  sendWorkshopChat,
  stopWorkshopAction,
} from '../../../actions';
import { AutoRefresh } from '../../../jobs/[id]/client';
import { ChatForm, PromptViewer, SamplePreview, WorkshopHeader } from './client';
import { ChatScroll, ResizableColumns } from './columns';

// 構成案を AI と相談しながら作る画面。
// ヘッダー: 戻る・名前（その場で変更）・試作する／停止・自動保存の表示・削除（構成案ごと）
// 左: AI に渡すプロンプト（そのまま） / 中央: 試作のプレビュー（動画・画像 / テキスト） / 右: 相談（列の幅は境目のドラッグで変えられる）
export default async function WorkshopPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sample?: string }>;
}) {
  const { id } = await params;
  const { sample: sampleId } = await searchParams;
  const found = await prisma.templateWorkshop.findUnique({
    where: { id },
    include: {
      account: { include: { platformConnections: true } },
      template: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!found) notFound();
  // 名前・構成の指示は構成案が持つ。プロンプトの組み立てに使えるよう、相談に重ねる
  const workshop = workshopContext(found);

  const busy = workshop.messages.some((m) => m.status === 'pending');
  const samples = workshop.messages.filter((m) => m.kind === 'sample' && m.role === 'assistant' && m.status === 'done' && m.sampleJson);
  const shown = samples.find((m) => m.id === sampleId) ?? samples[samples.length - 1];
  const script = shown ? safeJson<SampleScript>(shown.sampleJson, { title: '', lines: [] }) : null;
  const handle = workshop.account.platformConnections.find((c) => c.platform === 'youtube')?.handle ?? '';

  // 左の列に出すプロンプト。どれも今の下書きと会話から、AI に渡すときと同じ組み立て方で作る
  const prompts = await promptsForDisplay(workshop);
  const jobPrompt = buildJobPrompt({
    jobId: '(依頼ID)',
    repoDir: '(リポジトリ)',
    workDir: '(作業フォルダ)',
    theme: null,
    channel: workshop.account,
    template: { name: workshop.name, body: workshop.body },
  });
  const withSystem = (text: string) => `# システムプロンプト\n${SYSTEM_PROMPT}\n\n# プロンプト\n${text}`;

  return (
    <div className="page full-page">
      <AutoRefresh active={busy} interval={2000} />
      <WorkshopHeader
        name={workshop.name}
        busy={busy}
        rename={renameWorkshop.bind(null, workshop.id)}
        sample={requestWorkshopSample.bind(null, workshop.id)}
        stop={stopWorkshopAction.bind(null, workshop.id)}
        remove={deleteWorkshop.bind(null, workshop.id)}
      />

      <ResizableColumns
        left={
          <section className="card ws-fill-card">
            <PromptViewer
              tabs={[
                {
                  key: 'job',
                  label: '動画づくりの依頼',
                  note: `この構成案で動画づくりを依頼したときに、AI に渡す指示書です（${workshop.account.name}・テーマおまかせの見本）。「構成案」の節が、ここで作っている下書きです。`,
                  text: jobPrompt,
                },
                { key: 'sample', label: '試作', note: '「試作する」を押したときに AI に渡すプロンプトです（前回の話題で試作する場合）。', text: withSystem(prompts.sample) },
                { key: 'chat', label: '相談', note: '相談を送ったときに AI に渡すプロンプトです。最後の節に、送った内容が入ります。', text: withSystem(prompts.chat) },
              ]}
            />
          </section>
        }
        center={
          <section className="card ws-fill-card">
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
              <div className="empty">{busy ? 'AI が作業しています…' : 'まだ試作はありません。ヘッダーの「試作する」を押すか、チャットで「試作して」と頼んでください。'}</div>
            )}
          </section>
        }
        right={
          <section className="card ws-fill-card">
            {/* 発言の件数と状態が変わったら（返事が届いたら）下までスクロールする */}
            <ChatScroll count={workshop.messages.map((m) => `${m.id}:${m.status}`).join(',')}>
              {workshop.messages.length === 0 && (
                <p className="muted">どんな動画にしたいかを伝えてください。AI が構成案を直します（左のプロンプトの「構成案」の節に入ります）。「試作して」と頼むと、その構成案で台本を1本書いて中央に映像で見せます。</p>
              )}
              {workshop.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  {m.status === 'pending' && <span className="muted">{m.kind === 'sample' ? '試作しています…（30秒ほど）' : '考えています…'}</span>}
                  {m.status === 'failed' && <span className="notice ng">うまくいきませんでした: {m.error}</span>}
                  {m.status === 'canceled' && <span className="muted">{m.kind === 'sample' ? '試作を止めました' : '止めました'}</span>}
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
