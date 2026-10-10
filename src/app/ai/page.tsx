import { connection } from 'next/server';
import {
  DEFAULT_ANTIGRAVITY_BIN,
  DEFAULT_CLAUDE_BIN,
  DEFAULT_MODEL,
  PROVIDER_LABEL,
  PURPOSE_LABEL,
  PURPOSE_PROVIDERS,
  listModels,
  loadAiSettings,
  providerStatus,
  type AiProvider,
  type AiPurpose,
} from '@/lib/ai/providers';
import { clearAiApiKey, saveAiApiKey, saveAiAssignments, saveAiPaths, testAiProvider } from '../actions';
import { ActionButton } from '../projects/[id]/client';
import { ApiKeyForm, AssignmentsForm, PathsForm } from './client';

const PROVIDERS: AiProvider[] = ['claude-code', 'antigravity', 'anthropic-api', 'gemini-api'];

const PROVIDER_NOTE: Record<AiProvider, string> = {
  'claude-code': 'claude.ai のアカウントで動きます（API キー不要）。依頼・構成案の相談・動画編集のすべてに使えます。',
  antigravity: 'Antigravity IDE のチャットに依頼を送ります。動画づくりの依頼だけに使えます。',
  'anthropic-api': 'Anthropic の API キーで動きます（使った分だけ課金）。構成案の相談・動画編集に使えます。',
  'gemini-api': 'Google の Gemini API キーで動きます（使った分だけ課金）。構成案の相談・動画編集に使えます。',
};

const PURPOSE_NOTE: Record<AiPurpose, string> = {
  job: 'リサーチから制作まで自分で進めます。依頼の画面で選び直せます',
  workshop: '構成案の画面の「AI と相談して作る」',
  edit: '動画編集の画面の右の列',
};

// 連携している AI の状態・API キー・用途ごとの割り当て
export default async function AiPage() {
  // 状態（インストール・ログイン・API キー）は毎回その場で確かめる
  await connection();
  const settings = await loadAiSettings();
  const statuses = await Promise.all(PROVIDERS.map((p) => providerStatus(p, settings)));
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

  return (
    <div className="page">
      <h1>AI 連携</h1>
      <p className="lead">動画づくりに使う AI の状態と、どの用途にどの AI を使うかを設定します。</p>

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
          モデルを空欄にすると、Claude Code はその既定、Claude API は {DEFAULT_MODEL['anthropic-api']}、Gemini API は {DEFAULT_MODEL['gemini-api']} を使います。
          動画づくりの依頼（自分で調べて制作まで進めるもの）は、今は Claude Code と Antigravity だけが対応しています。
        </p>
      </section>

      {PROVIDERS.map((p) => {
        const s = status[p];
        return (
          <section key={p} className="card stack" style={{ gap: 10 }}>
            <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ margin: 0 }}>{PROVIDER_LABEL[p]}</h2>
              <span className={`badge${s.ready ? ' ok' : ''}`}>{s.summary}</span>
            </div>
            <p className="muted">{PROVIDER_NOTE[p]}</p>
            <table>
              <tbody>
                {s.details.map((d) => (
                  <tr key={d.label}><th style={{ width: 140 }}>{d.label}</th><td style={{ wordBreak: 'break-all' }}>{d.value}</td></tr>
                ))}
                {(p === 'anthropic-api' || p === 'gemini-api') && s.ready && (
                  <tr>
                    <th>使えるモデル</th>
                    <td>{modelErrors[p] ? <span className="notice ng">{modelErrors[p]}</span> : `${models[p].length} 件（割り当ての欄で候補に出ます）`}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {(p === 'anthropic-api' || p === 'gemini-api') && (
              <div className="stack" style={{ gap: 8 }}>
                <ApiKeyForm action={saveAiApiKey.bind(null, p)} placeholder={s.ready ? '（保存済み。変えるときだけ入力）' : p === 'anthropic-api' ? 'sk-ant-…' : 'AIza…'} />
                {s.ready && (
                  <ActionButton action={clearAiApiKey.bind(null, p)} label="API キーを消す" pendingLabel="消しています…" confirm={`${PROVIDER_LABEL[p]} の API キーを消します。よろしいですか？`} />
                )}
                <p className="muted">API キーはこのパソコンの .env.local に保存し、画面には末尾4文字だけを出します。</p>
              </div>
            )}
            {/* API キーの AI は、キーを保存するまで試せない */}
            {p !== 'antigravity' && s.ready && (
              <ActionButton
                action={testAiProvider.bind(null, p, testModel(p))}
                label={`接続テスト${testModel(p) ? `（${testModel(p)}）` : ''}`}
                pendingLabel="試しています…（数秒〜数十秒）"
              />
            )}
          </section>
        );
      })}

      <section className="card stack" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>AI の置き場所</h2>
        <p className="muted">Claude Code・Antigravity を既定とは違う場所に入れた場合だけ設定します。</p>
        <PathsForm
          action={saveAiPaths}
          values={{
            claudeBinPath: settings.claudeBinPath ?? '',
            antigravityBinPath: settings.antigravityBinPath ?? '',
            claudeDefault: DEFAULT_CLAUDE_BIN,
            antigravityDefault: DEFAULT_ANTIGRAVITY_BIN,
          }}
        />
      </section>
    </div>
  );
}
