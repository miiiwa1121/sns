import { connection } from 'next/server';
import {
  DEFAULT_MODEL,
  LOCAL_DEFAULT_BIN,
  LOCAL_KINDS,
  PROVIDER_LABEL,
  PURPOSE_LABEL,
  PURPOSE_PROVIDERS,
  listApiKeys,
  listModels,
  loadAiSettings,
  providerStatus,
  type AiProvider,
  type AiPurpose,
} from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { addApiKey, addLocalAi, deleteApiKey, deleteLocalAi, saveAiAssignments, testApiKey, testLocalAi } from '../actions';
import { ApiKeysTable, AssignmentsForm, LocalAiTable } from './client';

const PROVIDERS: AiProvider[] = ['claude-code', 'antigravity', 'anthropic-api', 'gemini-api'];

const PURPOSE_NOTE: Record<AiPurpose, string> = {
  job: '依頼の画面で選び直せます',
  workshop: '構成案の「AI と相談して作る」',
  edit: '動画編集の右の列',
};

// 連携している AI。用途ごとの割り当て / API（API キー）/ API 以外（このパソコンに入れた AI）
export default async function AiPage() {
  // 状態（インストール・ログイン・API キー）は毎回その場で確かめる
  await connection();
  const [settings, keys, locals] = await Promise.all([loadAiSettings(), listApiKeys(), prisma.localAiEntry.findMany({ orderBy: { createdAt: 'asc' } })]);
  const statuses = await Promise.all(PROVIDERS.map((p) => providerStatus(p, settings)));
  const status = Object.fromEntries(statuses.map((s) => [s.provider, s])) as Record<AiProvider, (typeof statuses)[number]>;
  // モデルの候補（取れなければ空。割り当ての欄では自由に入力もできる）
  const models = Object.fromEntries(await Promise.all(PROVIDERS.map(async (p) => [p, await listModels(p).catch(() => [])] as const)));

  return (
    <div className="page">
      <h1>AI 連携</h1>

      <section className="card stack" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>用途ごとの割り当て</h2>
        <AssignmentsForm
          action={saveAiAssignments}
          models={models}
          rows={(['job', 'workshop', 'edit'] as AiPurpose[]).map((purpose) => ({
            purpose,
            label: PURPOSE_LABEL[purpose],
            note: PURPOSE_NOTE[purpose],
            providers: PURPOSE_PROVIDERS[purpose].map((p) => ({ id: p, label: PROVIDER_LABEL[p], ready: status[p].ready })),
            provider: settings[purpose].provider,
            model: settings[purpose].model,
          }))}
        />
        <p className="muted">
          モデルが空欄なら、Claude Code はその既定、Claude API は {DEFAULT_MODEL['anthropic-api']}、Gemini API は {DEFAULT_MODEL['gemini-api']} を使います。動画づくりの依頼は Claude Code と Antigravity だけが対応しています。
        </p>
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
