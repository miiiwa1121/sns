import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { JOB_STATUS_LABEL, PROVIDER_LABEL, elapsed, loadJob, parseAiSteps, readJobLog } from '@/lib/jobs';
import { JOB_PURPOSES, PROVIDER_LABEL as AI_LABEL, PURPOSE_LABEL } from '@/lib/ai/providers';
import { JobLog, JobProgress } from '../JobLog';
import { cancelJob } from '@/app/actions';
import { ActionButton } from '../../projects/[id]/client';
import { AutoRefresh } from './client';
import { safeJson } from '@/lib/json';
import { parseProduce, parseProduceRequest, produceLabel, produceRequestLabel } from '@/lib/services/produceSettings';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await loadJob(id);
  if (!job) notFound();
  const running = job.status === 'running';
  const log = job.provider === 'antigravity' ? [] : readJobLog(job.id);
  const steps = parseAiSteps(job.aiStepsJson);
  // 制作: 依頼で選んだもの（おまかせを含む）と、実際に作ったときの設定
  const produceRequest = parseProduceRequest(job.produceJson);
  const produced = parseProduce(job.project?.shortClips[0]?.produceJson);
  const prohibitions = safeJson<string[]>(job.prohibitionsJson, []);

  return (
    <div className="page">
      <AutoRefresh active={running} />
      <Link href="/new" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />作成する</Link>

      <div className="row between">
        <h1>依頼: {job.theme ?? 'おまかせ'}</h1>
        <span className={`badge${running ? ' you' : job.status === 'succeeded' ? ' ok' : job.status === 'failed' ? ' ng' : ''}`}>
          {JOB_STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>
      <p className="muted">
        {job.account.name} ・ {steps ? JOB_PURPOSES.map((p) => `${PURPOSE_LABEL[p]} ${AI_LABEL[steps[p].provider]}（${steps[p].model}）`).join('・') : PROVIDER_LABEL[job.provider] ?? job.provider}{job.templateName && ` ・ 構成案: ${job.templateName}`}{job.researchMethodName && ` ・ リサーチ手法: ${job.researchMethodName}`} ・ {job.createdAt.toLocaleString('ja-JP')} 開始 ・ {elapsed(job.createdAt, job.finishedAt ?? undefined)}
      </p>
      {produceRequest && <p className="muted">制作: {produceRequestLabel(produceRequest)}{produced && ` → ${produceLabel(produced)}`}</p>}
      {prohibitions.length > 0 && <p className="muted">禁止事項: {prohibitions.join(' ／ ')}</p>}
      {job.provider !== 'antigravity' && <JobProgress phase={job.phase} done={job.status === 'succeeded'} />}

      {job.project && (
        <div className="card row between">
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted">作られた企画</span>
            <strong>{job.project.title}</strong>
          </div>
          <Link href={`/projects/${job.project.id}`} className="btn primary">企画を開く</Link>
        </div>
      )}
      {job.error && <p className="notice ng">{job.error}</p>}

      {job.provider === 'antigravity' && running && (
        <div className="card stack" style={{ gap: 6 }}>
          <p>Antigravity IDE のチャットに依頼を送りました。進み具合は IDE で確認してください。</p>
          <p className="muted">操作の許可を求められたら、IDE で許可してください。動画ができると、この依頼は自動で「完了」になります。</p>
        </div>
      )}

      {job.provider !== 'antigravity' && (
        <section>
          <h2>作業の記録</h2>
          <div className="card">
            <JobLog entries={log} />
          </div>
        </section>
      )}

      {running && (
        <ActionButton action={cancelJob.bind(null, job.id)} label="依頼を中止する" pendingLabel="中止中…" confirm="作業中の依頼を中止します。よろしいですか？" />
      )}
    </div>
  );
}
