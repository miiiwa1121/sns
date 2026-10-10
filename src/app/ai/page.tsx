import { connection } from 'next/server';
import {
  JOB_PURPOSES,
  LOCAL_DEFAULT_BIN,
  LOCAL_KINDS,
  PROVIDER_LABEL,
  PURPOSE_LABEL,
  listApiKeys,
  purposeChoices,
  loadAiSettings,
  providerStatus,
  type AiProvider,
  type JobPurpose,
} from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { addApiKey, addLocalAi, deleteApiKey, deleteLocalAi, saveAiAssignments, testApiKey, testLocalAi } from '../actions';
import { ApiKeysTable, AssignmentsForm, LocalAiTable } from './client';

const PROVIDERS: AiProvider[] = ['claude-code', 'antigravity', 'anthropic-api', 'gemini-api'];

// 動画づくりの依頼の工程（構成案の相談・動画編集の AI は、それぞれの画面のチャット欄で選ぶ）
const PURPOSE_NOTE: Record<JobPurpose, string> = {
  research: 'Web で調べて話題を決め、登録する（Web 検索を使うため Claude Code のみ）',
  script: 'リサーチの結果から台本と投稿文を書く',
  check: '確認用の静止画を見て直し、報告する（画像を見て直すため Claude Code のみ）',
};

// 連携している AI。用途ごとの割り当て / API（API キー）/ API 以外（このパソコンに入れた AI）
export default async function AiPage() {
  // 状態（インストール・ログイン・API キー）は毎回その場で確かめる
  await connection();
  const [settings, keys, locals] = await Promise.all([loadAiSettings(), listApiKeys(), prisma.localAiEntry.findMany({ orderBy: { createdAt: 'asc' } })]);
  const statuses = await Promise.all(PROVIDERS.map((p) => providerStatus(p, settings)));
  const status = Object.fromEntries(statuses.map((s) => [s.provider, s])) as Record<AiProvider, (typeof statuses)[number]>;

  return (
    <div className="page">
      <h1>AI 連携</h1>

      <section className="card stack" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>動画づくりの依頼</h2>
        <p className="muted">「作成する」の依頼は、工程ごとにここで選んだ AI とモデルで作業します。制作（音声とレンダリング）はシステムが行うので AI は使いません。</p>
        <AssignmentsForm
          action={saveAiAssignments}
          rows={await Promise.all(
            JOB_PURPOSES.map(async (purpose) => ({ purpose, label: PURPOSE_LABEL[purpose], note: PURPOSE_NOTE[purpose], ...(await purposeChoices(purpose, settings)) }))
          )}
        />
        <p className="muted">制作（声・話す速さ・BGM）は「作成する」で依頼ごとに選びます。構成案の相談・試作と動画編集の手直しの AI は、それぞれの画面のチャット欄で選びます。</p>
      </section>

      <div className="ai-group">
        <h2>API</h2>
        <section className="card">
          <ApiKeysTable rows={keys} add={addApiKey} remove={deleteApiKey} test={testApiKey} />
        </section>
      </div>

      <div className="ai-group">
        <h2>API 以外</h2>
        <section className="card">
          <LocalAiTable
            rows={locals.map((l) => {
              const s = status[l.kind as AiProvider];
              return {
                kind: l.kind,
                kindLabel: PROVIDER_LABEL[l.kind as AiProvider] ?? l.kind,
                label: l.label,
                binPath: l.binPath,
                summary: s?.summary ?? '',
                ready: Boolean(s?.ready),
                version: s?.details.find((d) => d.label === 'バージョン')?.value ?? null,
              };
            })}
            kinds={LOCAL_KINDS.map((k) => PROVIDER_LABEL[k])}
            addable={LOCAL_KINDS.filter((k) => !locals.some((l) => l.kind === k)).map((k) => ({ kind: k, label: PROVIDER_LABEL[k], defaultBin: LOCAL_DEFAULT_BIN[k] }))}
            add={addLocalAi}
            remove={deleteLocalAi}
            test={testLocalAi}
          />
        </section>
      </div>
    </div>
  );
}
