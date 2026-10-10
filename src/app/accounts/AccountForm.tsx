'use client';

import { useActionState } from 'react';
import type { ActionState } from '../actions';
import { PLATFORM_LABEL, type PlatformType } from '@/lib/types';

// ハンドルを入れる SNS（投稿の検証は当面 YouTube のみだが、ハンドルは全媒体ぶん持っておく）
const HANDLE_PLATFORMS: PlatformType[] = ['youtube', 'tiktok', 'instagram', 'x'];

type Values = {
  name?: string;
  slug?: string;
  category?: string;
  concept?: string;
  targetAudience?: string;
  defaultTemplateId?: string | null;
  handles?: Partial<Record<PlatformType, string>>;
};

type TemplateOption = { id: string; name: string };

export function AccountForm({
  action,
  values = {},
  isNew,
  templates,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: Values;
  isNew?: boolean;
  templates: TemplateOption[];
}) {
  const [state, run, pending] = useActionState(action, null);
  const field = (name: 'name' | 'slug' | 'category' | 'concept' | 'targetAudience', label: string, opts: { multiline?: boolean; placeholder?: string; hint?: string } = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {opts.multiline ? (
        <textarea id={name} name={name} className="input" rows={3} defaultValue={values[name] ?? ''} placeholder={opts.placeholder} />
      ) : (
        <input id={name} name={name} className="input" defaultValue={values[name] ?? ''} placeholder={opts.placeholder} />
      )}
      {opts.hint && <span className="muted">{opts.hint}</span>}
    </div>
  );
  return (
    <form action={run} className="card stack" style={{ gap: 16 }}>
      {field('name', 'アカウント名', { placeholder: '例: ついていくのが精一杯' })}
      {isNew && field('slug', 'ID（半角英小文字・数字・-・_）', { placeholder: '例: tuiteikunogaseiippai', hint: 'あとから変更できません。YouTube 連携のコマンドで使います' })}
      {field('category', 'カテゴリ', { placeholder: 'AI・IT' })}
      {field('concept', 'コンセプト', { multiline: true, hint: 'AI が話題選びと台本づくりに使います' })}
      {field('targetAudience', '想定する視聴者', { multiline: true })}
      <div className="field">
        <label htmlFor="defaultTemplateId">既定の構成案</label>
        <select id="defaultTemplateId" name="defaultTemplateId" className="input" defaultValue={values.defaultTemplateId ?? templates[0]?.id}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="muted">依頼するときに選び直せます。話し方・台本のルール・尺や流れは、構成案で決めます</span>
      </div>
      <div className="field">
        <label>SNS のハンドル</label>
        <div className="handle-grid">
          {HANDLE_PLATFORMS.map((p) => (
            <label key={p} className="handle-row">
              <span>{PLATFORM_LABEL[p]}</span>
              <input name={`handle_${p}`} className="input" defaultValue={values.handles?.[p] ?? ''} placeholder="@example" />
            </label>
          ))}
        </div>
        <span className="muted">動画の画面下に出すハンドルは YouTube のものです</span>
      </div>
      <div>
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : isNew ? 'アカウントを追加する' : '保存する'}</button>
      </div>
      {state && <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>}
    </form>
  );
}
