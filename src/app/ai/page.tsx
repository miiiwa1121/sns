import { connection } from 'next/server';
import {
  DEFAULT_MODEL,
  PROVIDER_LABEL,
  PURPOSE_LABEL,
  PURPOSE_PROVIDERS,
  apiKeyEnvName,
  listApiKeys,
  listModels,
  loadAiSettings,
  providerStatus,
  type AiProvider,
  type AiPurpose,
} from '@/lib/ai/providers';
import { addApiKey, deleteApiKey, saveAiAssignments, testAiProvider } from '../actions';
import { ActionButton } from '../projects/[id]/client';
import { ApiKeysTable, AssignmentsForm } from './client';

const API_PROVIDERS: AiProvider[] = ['anthropic-api', 'gemini-api'];
const OTHER_PROVIDERS: AiProvider[] = ['claude-code', 'antigravity'];
const PROVIDERS = [...API_PROVIDERS, ...OTHER_PROVIDERS];

const PURPOSE_NOTE: Record<AiPurpose, string> = {
  job: '依頼の画面で選び直せます',
  workshop: '構成案の「AI と相談して作る」',
  edit: '動画編集の右の列',
};

// 連携している AI。用途ごとの割り当て / API（キーと Claude API・Gemini API）/ API 以外（Claude Code・Antigravity）
export default async function AiPage() {
  // 状態（インストール・ログイン・API キー）は毎回その場で確かめる
  await connection();
  const settings = await loadAiSettings();
  const [statuses, keys] = await Promise.all([Promise.all(PROVIDERS.map((p) => providerStatus(p, settings))), listApiKeys()]);
  const status = Object.fromEntries(statuses.map((s) => [s.provider, s])) as Record<AiProvider, (typeof statuses)[number]>;
  const modelErrors: Partial<Record<AiProvider, string>> = {};
  const models = Object.fromEntries(
    await Promise.all(
      PROVIDERS.map(async (p) => {
        try {
          return [p, await listModels(p)] as const;
        } catch (error) {
          modelErrors[p] = error instanceof Error ? error.message : String(error);
          return [p, []] as const;
        }
      })
    )
  );
  // 接続テストで使うモデル（その AI を割り当てている用途のモデル。なければ既定）
  const testModel = (p: AiProvider) => (['workshop', 'edit', 'job'] as AiPurpose[]).map((u) => settings[u]).find((a) => a.provider === p && a.model)?.model ?? DEFAULT_MODEL[p];

  const card = (p: AiProvider) => {
    const s = status[p];
    return (
      <section key={p} className="card stack" style={{ gap: 10 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>{PROVIDER_LABEL[p]}</h3>
          <span className={`badge${s.ready ? ' ok' : ''}`}>{s.summary}</span>
        </div>
        <table>
          <tbody>
            {s.details.map((d) => (
              <tr key={d.label}><th style={{ width: 140 }}>{d.label}</th><td style={{ wordBreak: 'break-all' }}>{d.value}</td></tr>
            ))}
            {apiKeyEnvName(p) && s.ready && (
              <tr>
                <th>使えるモデル</th>
                <td>{modelErrors[p] ? <span className="notice ng">{modelErrors[p]}</span> : `${models[p].length} 件`}</td>
              </tr>
            )}
          </tbody>
        </table>
        {/* Antigravity は IDE で動くため試せない。API はキーを登録するまで試せない */}
        {p !== 'antigravity' && s.ready && (
          <ActionButton action={testAiProvider.bind(null, p, testModel(p))} label={`接続テスト${testModel(p) ? `（${testModel(p)}）` : ''}`} pendingLabel="試しています…" />
        )}
      </section>
    );
  };

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
        <section className="card stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0 }}>API キー</h3>
          <ApiKeysTable rows={keys} add={addApiKey} remove={deleteApiKey} />
          <p className="muted">Claude API は ANTHROPIC_API_KEY、Gemini API は GEMINI_API_KEY を使います。値はこのパソコンの .env.local に保存し、画面には末尾4文字だけを出します。</p>
        </section>
        {API_PROVIDERS.map(card)}
      </div>

      <div className="ai-group">
        <h2>API 以外</h2>
        {OTHER_PROVIDERS.map(card)}
      </div>
    </div>
  );
}
