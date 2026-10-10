import { connection } from 'next/server';
import { formatBytes, loadSettings, planCleanup, storageUsage } from '@/lib/services/cleanupService';
import { cleanupNow, saveCleanup, saveYouTubeClient } from '../actions';
import { ActionButton, ActionForm } from '../projects/[id]/client';
import { formatDate } from '../ui';

const KIND_LABEL = { work: '作業ファイル', video: '動画・サムネ', job: '依頼の作業フォルダ' } as const;

// サービス全体の設定（YouTube API のクライアント、生成物の整理）
export default async function SettingsPage() {
  // ファイルの容量は毎回その場で測る
  await connection();
  const settings = await loadSettings();
  const usage = storageUsage();
  const plan = await planCleanup(settings);
  const planBytes = plan.reduce((sum, i) => sum + i.bytes, 0);
  const clientId = process.env.YOUTUBE_CLIENT_ID ?? '';
  const clientSecretSet = Boolean(process.env.YOUTUBE_CLIENT_SECRET);

  return (
    <div className="page">
      <h1>設定</h1>

      <section className="card stack" style={{ gap: 12 }}>
        <h2>YouTube API</h2>
        <p className="lead">
          YouTube への投稿と再生数の取得に使う、Google Cloud の OAuth クライアント（種類は「デスクトップアプリ」）です。全アカウントで共通です。
          作り方は docs/operations/youtube-setup.md の手順 1 を参照してください。保存したら、各アカウントの画面で「YouTube と連携する」を押します。
        </p>
        <p>
          {clientId && clientSecretSet ? <span className="badge ok">設定済み</span> : <span className="badge">未設定</span>}{' '}
          {clientId && <span className="muted">{clientId}</span>}
        </p>
        <ActionForm action={saveYouTubeClient} submitLabel="保存する">
          <div className="field">
            <label htmlFor="clientId">クライアント ID</label>
            <input id="clientId" name="clientId" className="input" placeholder={clientId || 'xxxx.apps.googleusercontent.com'} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="clientSecret">クライアント シークレット</label>
            <input id="clientSecret" name="clientSecret" type="password" className="input" placeholder={clientSecretSet ? '（保存済み。変えるときだけ入力）' : 'GOCSPX-…'} autoComplete="off" />
          </div>
        </ActionForm>
        <p className="muted">空欄の項目は今の値のまま残ります。シークレットは画面に表示しません。</p>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <h2>保存しているファイル</h2>
        <p className="lead">作った動画・作業ファイル・依頼の記録は、このパソコンの中に保存しています。放っておくと増え続けるので、古いものを整理します。</p>
        <table>
          <tbody>
            <tr><th>企画（動画・作業ファイル）</th><td>{formatBytes(usage.projects)}</td></tr>
            <tr><th>依頼の作業フォルダ</th><td>{formatBytes(usage.jobs)}</td></tr>
            <tr><th>その他</th><td>{formatBytes(usage.other)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <h2>整理のルール</h2>
        <ActionForm action={saveCleanup} submitLabel="保存する">
          <div className="field">
            <label htmlFor="days">YouTube に公開して（依頼が終わって）から何日たったら整理するか</label>
            <input id="days" name="days" type="number" min={1} max={3650} className="input" style={{ maxWidth: 140 }} defaultValue={settings.cleanupDays} />
          </div>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" name="includeVideo" defaultChecked={settings.cleanupIncludeVideo} />
            動画とサムネも消す（オフなら作業ファイルだけを消し、動画は残す）
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" name="auto" defaultChecked={settings.cleanupAuto} />
            自動で整理する（動画づくりの依頼が終わるたびに実行）
          </label>
        </ActionForm>
        <p className="muted">動画を消した企画も、企画・投稿・分析の記録は残ります。YouTube に公開した動画には影響しません。</p>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <h2>今すぐ整理する</h2>
        {plan.length === 0 ? (
          <p className="lead">いまのルールで整理する対象はありません。</p>
        ) : (
          <>
            <p className="lead">いまのルールで、次の {plan.length} 件・{formatBytes(planBytes)} が消えます。</p>
            <table>
              <thead><tr><th>種類</th><th>対象</th><th>容量</th></tr></thead>
              <tbody>
                {plan.map((i) => (
                  <tr key={i.targets[0]}><td>{KIND_LABEL[i.kind]}</td><td>{i.label}</td><td>{formatBytes(i.bytes)}</td></tr>
                ))}
              </tbody>
            </table>
            <ActionButton action={cleanupNow} label="整理する" pendingLabel="整理中…" confirm={`${plan.length} 件・${formatBytes(planBytes)} を削除します。元に戻せません。よろしいですか？`} />
          </>
        )}
        <p className="muted">
          最後に整理した日時: {settings.lastCleanupAt ? `${formatDate(settings.lastCleanupAt)}（${formatBytes(settings.lastCleanupBytes ?? 0)} を削除）` : 'まだありません'}
        </p>
      </section>
    </div>
  );
}
