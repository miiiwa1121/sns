'use client';

import { useActionState } from 'react';
import type { ActionState } from '../actions';

type Values = {
  name?: string;
  slug?: string;
  category?: string;
  concept?: string;
  targetAudience?: string;
  toneOfVoice?: string;
  systemPromptRules?: string | null;
  youtubeHandle?: string;
};

export function AccountForm({
  action,
  values = {},
  isNew,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  values?: Values;
  isNew?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const field = (name: keyof Values, label: string, opts: { multiline?: boolean; placeholder?: string; hint?: string } = {}) => (
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
      {field('toneOfVoice', '話し方', { placeholder: '例: 親しみやすく、肩の力が抜けた分かりやすい語り口' })}
      {field('systemPromptRules', '台本のルール（任意）', { multiline: true })}
      {field('youtubeHandle', 'YouTube ハンドル', { placeholder: '@example' })}
      <div>
        <button className="btn primary" disabled={pending}>{pending ? '保存中…' : isNew ? 'アカウントを追加する' : '保存する'}</button>
      </div>
      {state && <p className={`notice ${state.ok ? 'ok' : 'ng'}`}>{state.message}</p>}
    </form>
  );
}
