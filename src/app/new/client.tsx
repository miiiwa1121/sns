'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { createVideoJob, loadVoicevoxVoices, type ActionState } from '../actions';

type Option = { id: string; name: string };
type LabeledOption = { id: string; label: string };
type AccountOption = { id: string; name: string; defaultTemplateId: string; defaultResearchMethodId: string };
type ProhibitionOption = { id: string; text: string; isDefault: boolean };

export function JobForm({
  disabled,
  accounts,
  currentAccountId,
  templates,
  researchMethods,
  prohibitions,
  workers,
  aiProblem,
  produce,
}: {
  disabled: boolean;
  accounts: AccountOption[]; // 既定の構成案・リサーチ手法は解決済み（未設定なら一覧の先頭）
  currentAccountId: string;
  templates: Option[];
  researchMethods: Option[];
  prohibitions: ProhibitionOption[];
  workers: { step: string; ai: string; model: string }[]; // 工程ごとの AI（「AI 連携」の割り当て。ここでは選ばない）
  aiProblem: string | null; // 割り当てた AI が使えない理由
  produce: { voices: LabeledOption[]; speeds: number[]; bgms: LabeledOption[]; voicevoxListed: boolean }; // 制作で選べるもの
}) {
  const [state, run, pending] = useActionState(createVideoJob, null);
  const [accountId, setAccountId] = useState(currentAccountId);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  return (
    <form action={run} className="card stack" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="accountId">アカウント</label>
        <select id="accountId" name="accountId" className="input" value={account.id} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="muted">コンセプトと視聴者を AI に伝えます。構成案とリサーチ手法は、このアカウントの既定が選ばれます</span>
      </div>
      <div className="field">
        <label htmlFor="theme">お題（任意）</label>
        <textarea id="theme" name="theme" className="input" rows={3} placeholder="例: 最近の AI エージェントの新機能&#10;空欄なら、リサーチ手法に従っておまかせで選びます" />
      </div>
      {/* アカウントを変えたら、そのアカウントの既定を選び直す（key で作り直す） */}
      <Choice key={`t-${account.id}`} name="templateId" label="構成案" options={templates} defaultId={account.defaultTemplateId}>
        尺や流れの型です。中身は<Link href="/templates">「構成案」</Link>で確認・編集できます
      </Choice>
      <Choice key={`r-${account.id}`} name="researchMethodId" label="リサーチ手法" options={researchMethods} defaultId={account.defaultResearchMethodId}>
        話題の探し方です。中身は<Link href="/research-methods">「リサーチ手法」</Link>で確認・編集できます
      </Choice>
      <div className="field">
        <label>禁止事項</label>
        {prohibitions.length === 0 ? (
          <span className="muted">まだありません。<Link href="/prohibitions">「禁止事項」</Link>で追加できます</span>
        ) : (
          <>
            <div className="stack" style={{ gap: 6 }}>
              {prohibitions.map((p) => (
                <label key={p.id} className="row" style={{ gap: 8, alignItems: 'flex-start', fontWeight: 600 }}>
                  <input type="checkbox" name="prohibitionIds" value={p.id} defaultChecked={p.isDefault} style={{ marginTop: 4 }} />
                  <span>{p.text}</span>
                </label>
              ))}
            </div>
            <span className="muted">選んだものを AI に守らせます。一覧は<Link href="/prohibitions">「禁止事項」</Link>で編集できます</span>
          </>
        )}
      </div>
      <ProduceFields {...produce} />
      <p className="muted">
        工程: {workers.map((w, i) => (
          <span key={w.step}>{i > 0 && ' ・ '}{w.step} <strong>{w.ai}</strong>（{w.model}）</span>
        ))}（<Link href="/ai">「AI 連携」</Link>で変更）
      </p>
      {aiProblem && <p className="notice ng">{aiProblem}</p>}
      <div>
        <button className="btn primary" disabled={pending || disabled || aiProblem !== null}>{pending ? '依頼中…' : '依頼する'}</button>
      </div>
      {disabled && <p className="muted">作業中の依頼が終わると、次を依頼できます。</p>}
      {state && !state.ok && <p className="notice ng">{state.message}</p>}
    </form>
  );
}

// 構成案・リサーチ手法の選択
function Choice({ name, label, options, defaultId, children }: { name: string; label: string; options: Option[]; defaultId: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" defaultValue={defaultId}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}{o.id === defaultId ? '（このアカウントの既定）' : ''}</option>
        ))}
      </select>
      <span className="muted">{children}</span>
    </div>
  );
}

// 制作（AI は使わず、システムが音声合成とレンダリングを行う）の声・速さ・BGM。既定は「おまかせ」で、台本の担当 AI が内容に合わせて選ぶ
function ProduceFields({ voices, speeds, bgms, voicevoxListed }: { voices: LabeledOption[]; speeds: number[]; bgms: LabeledOption[]; voicevoxListed: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  // VOICEVOX の声の一覧を取り込む（エンジンを一時的に起動するので1分ほどかかる）。取り込んだら選択肢を出し直す
  const loadVoices = () =>
    start(async () => {
      const result = await loadVoicevoxVoices();
      setState(result);
      if (result?.ok) router.refresh();
    });
  const select = (name: string, label: string, options: { value: string; label: string }[]) => (
    <label className="produce-field">
      <span className="muted">{label}</span>
      <select name={name} className="input" defaultValue="auto">
        <option value="auto">おまかせ</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  return (
    <div className="field">
      <label>制作</label>
      <div className="stack" style={{ gap: 6 }}>
        {select('produceVoice', '声', voices.map((v) => ({ value: v.id, label: v.label })))}
        {select('produceSpeed', '速さ', speeds.map((sp) => ({ value: String(sp), label: `${sp}倍` })))}
        {select('produceBgm', 'BGM', bgms.map((b) => ({ value: b.id, label: b.label })))}
      </div>
      <span className="muted">
        台本から音声を作り、動画に書き出します（AI は使いません）。「おまかせ」は、台本の担当 AI が内容に合わせて選びます。BGM は remotion/public/bgm/ に置いた音楽ファイルから選べます。
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" disabled={pending} onClick={loadVoices}>
          {pending ? '読み込み中…（VOICEVOX を起動しています。1分ほど）' : voicevoxListed ? 'VOICEVOX の声の一覧を読み込み直す' : 'VOICEVOX の声の一覧を読み込む'}
        </button>
        {state && <span className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</span>}
      </div>
    </div>
  );
}
