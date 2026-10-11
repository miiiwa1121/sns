import { connection } from 'next/server';
import {
  LOCAL_DEFAULT_BIN,
  LOCAL_KINDS,
  PROVIDER_LABEL,
  listApiKeys,
  loadAiSettings,
  providerStatus,
  type AiProvider,
} from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { addApiKey, addLocalAi, deleteApiKey, deleteLocalAi, testApiKey, testLocalAi } from '../actions';
import { ApiKeysTable, LocalAiTable } from './client';

const PROVIDERS: AiProvider[] = ['claude-code', 'antigravity', 'anthropic-api', 'gemini-api'];


// 連携している AI。API（API キー）/ API 以外（このパソコンに入れた AI）
export default async function AiPage() {
  // 状態（インストール・ログイン・API キー）は毎回その場で確かめる
  await connection();
  const [settings, keys, locals] = await Promise.all([loadAiSettings(), listApiKeys(), prisma.localAiEntry.findMany({ orderBy: { createdAt: 'asc' } })]);
  const statuses = await Promise.all(PROVIDERS.map((p) => providerStatus(p, settings)));
  const status = Object.fromEntries(statuses.map((s) => [s.provider, s])) as Record<AiProvider, (typeof statuses)[number]>;

  return (
    <div className="page">
      <h1>AI 連携</h1>


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
