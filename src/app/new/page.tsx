import Link from 'next/link';
import { listChannels } from '@/lib/channel';
import { JOB_STATUS_LABEL, jobAiLabel, loadJobs, loadRunningJobs } from '@/lib/jobs';
import { NoChannel } from '../ui';
import { JobForm } from './client';
import { listTemplates } from '@/lib/services/templateService';
import { SPEED_OPTIONS, bgmOptions, voiceOptions, voicevoxListed } from '@/lib/services/produceSettings';
import { listProhibitions, listResearchMethods } from '@/lib/services/researchMethodService';
import { JOB_PURPOSES, PROVIDER_LABEL as AI_LABEL, PURPOSE_LABEL, loadAiSettings, providerProblem } from '@/lib/ai/providers';

export default async function NewVideoPage() {
  const accounts = await listChannels();
  if (accounts.length === 0) return <div className="page"><h1>作成する</h1><NoChannel /></div>;
  const jobs = await loadJobs();
  // 同時に動かすのは全アカウントで1件まで（依頼の実行側と同じ判定）
  const running = (await loadRunningJobs()).length > 0;
  const [templates, researchMethods, prohibitions, ai] = await Promise.all([listTemplates(), listResearchMethods(), listProhibitions(), loadAiSettings()]);
  const pick = <T extends { id: string }>(list: T[], id: string | null) => (list.find((x) => x.id === id) ?? list[0]).id;
  const option = ({ id, name }: { id: string; name: string }) => ({ id, name });

  return (
    <div className="page">
      <h1>作成する</h1>
      <p className="lead">
        アカウント・お題・構成案・リサーチ手法・禁止事項を選んで依頼します。AI がリサーチ・台本・動画制作・点検まで行い、承認の手前で止まります。できあがるとホームの「あなたの番」に出てきます（10〜20分ほど）。
      </p>
      <JobForm
        disabled={running}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          defaultTemplateId: pick(templates, a.defaultTemplateId),
          defaultResearchMethodId: pick(researchMethods, a.defaultResearchMethodId),
        }))}
        currentAccountId={accounts[0].id}
        templates={templates.map(option)}
        researchMethods={researchMethods.map(option)}
        prohibitions={prohibitions.map(({ id, text, isDefault }) => ({ id, text, isDefault }))}
        workers={JOB_PURPOSES.map((p) => ({ step: PURPOSE_LABEL[p], ai: AI_LABEL[ai[p].provider], model: ai[p].model }))}
        produce={{ voices: voiceOptions(), speeds: SPEED_OPTIONS, bgms: bgmOptions(), voicevoxListed: voicevoxListed() }}
        aiProblem={JOB_PURPOSES.map((p) => providerProblem(ai[p].provider, ai)).find(Boolean) ?? null}
      />

      {jobs.length > 0 && (
        <section>
          <h2>これまでの依頼</h2>
          <div className="card flat list">
            {jobs.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`}>
                <div className="grow stack" style={{ gap: 4 }}>
                  <span className="title">{j.project?.title ?? j.theme ?? 'おまかせ'}</span>
                  <span className="muted">{j.account.name} ・ {j.createdAt.toLocaleString('ja-JP')} ・ {jobAiLabel(j)}{j.templateName && ` ・ ${j.templateName}`}{j.researchMethodName && ` ・ ${j.researchMethodName}`}</span>
                </div>
                <div className="side">
                  <span className={`badge${j.status === 'running' ? ' you' : j.status === 'succeeded' ? ' ok' : j.status === 'failed' ? ' ng' : ''}`}>
                    {JOB_STATUS_LABEL[j.status] ?? j.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
