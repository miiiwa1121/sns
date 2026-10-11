import Link from 'next/link';
import { listChannels } from '@/lib/channel';
import { JOB_STATUS_LABEL, jobAiLabel, loadJobs, loadRunningJobs } from '@/lib/jobs';
import { NoChannel } from '../ui';
import { JobForm } from './client';
import { listTemplates } from '@/lib/services/templateService';
import { SPEED_OPTIONS, bgmOptions, voiceOptions, voicevoxListed } from '@/lib/services/produceSettings';
import { listProhibitions, listResearchMethods } from '@/lib/services/researchMethodService';
import { JOB_PURPOSES, PURPOSE_LABEL, loadAiSettings, purposeChoices } from '@/lib/ai/providers';

// 動画づくりの依頼の工程（制作は AI を使わず、システムが行う）
const STEP_NOTE = {
  research: 'Web で調べて話題を決め、登録する（Web 検索を使うため Claude Code のみ）',
  script: 'リサーチの結果から台本と投稿文を書く',
  check: '確認用の静止画を見て直し、報告する（画像を見て直すため Claude Code のみ）',
} as const;

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
        steps={await Promise.all(JOB_PURPOSES.map(async (p) => ({ purpose: p, label: PURPOSE_LABEL[p], note: STEP_NOTE[p], ...(await purposeChoices(p, ai)) })))}
        produce={{ voices: voiceOptions(), speeds: SPEED_OPTIONS, bgms: bgmOptions(), voicevoxListed: voicevoxListed() }}
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
