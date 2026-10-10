'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { MOODS, SCENE_TYPES, type Mood, type Scene } from '../../../../../remotion/types';
import type { ScriptLine } from '@/lib/script';

// 台本の行の編集（左の列）。1行 = 読み上げ1回 = 字幕1枚

const SCENE_LABEL: Record<Scene['type'], string> = {
  hook: 'hook（つかみ）',
  keyword: 'keyword（要点）',
  compare: 'compare（比較）',
  chat: 'chat（チャット画面）',
  timeline: 'timeline（手順）',
  chips: 'chips（項目を並べる）',
  select: 'select（選択肢）',
  outro: 'outro（締め）',
};

const MOOD_LABEL: Record<Mood, string> = { panic: 'panic（焦り）', surprised: 'surprised（驚き）', happy: 'happy（喜び）', think: 'think（考える）', nod: 'nod（うなずき）' };

// 場面の種類を変えたときの初期値
const EMPTY_SCENE: Record<Scene['type'], Scene> = {
  hook: { type: 'hook', text: '' },
  keyword: { type: 'keyword', text: '' },
  compare: { type: 'compare', left: { label: '', body: '' }, right: { label: '', body: '' } },
  chat: { type: 'chat', user: '', reply: { type: 'text', text: '' } },
  timeline: { type: 'timeline', steps: [{ label: '' }] },
  chips: { type: 'chips', items: [''] },
  select: { type: 'select', options: ['', ''] },
  outro: { type: 'outro' },
};

// 場面の項目。kind: text（1行）/ area（複数行）/ list（1行に1つ）/ steps（「見出し | 説明」を1行に1つ）/ number / json
type Field = { path: string; label: string; kind: 'text' | 'area' | 'list' | 'steps' | 'number' | 'json' };

const SCENE_FIELDS: Record<Scene['type'], Field[]> = {
  hook: [
    { path: 'text', label: '大きな文字', kind: 'area' },
    { path: 'sub', label: 'バッジ（任意）', kind: 'text' },
  ],
  keyword: [
    { path: 'label', label: 'ラベル（任意）', kind: 'text' },
    { path: 'text', label: '要点', kind: 'area' },
  ],
  compare: [
    { path: 'left.label', label: '左の見出し', kind: 'text' },
    { path: 'left.body', label: '左の本文', kind: 'area' },
    { path: 'right.label', label: '右の見出し', kind: 'text' },
    { path: 'right.body', label: '右の本文', kind: 'area' },
  ],
  chat: [
    { path: 'user', label: '質問', kind: 'area' },
    { path: 'reply', label: '返答（JSON。type は text / table / bill / chart / calculator）', kind: 'json' },
  ],
  timeline: [
    { path: 'title', label: '見出し（任意）', kind: 'text' },
    { path: 'steps', label: 'ステップ（1行に1つ。「見出し | 説明」）', kind: 'steps' },
  ],
  chips: [
    { path: 'title', label: '見出し（任意）', kind: 'text' },
    { path: 'items', label: '項目（1行に1つ）', kind: 'list' },
  ],
  select: [
    { path: 'title', label: '見出し（任意）', kind: 'text' },
    { path: 'options', label: '選択肢（1行に1つ）', kind: 'list' },
    { path: 'selected', label: '選ぶ番号（任意。1から。省略すると最後）', kind: 'number' },
  ],
  outro: [{ path: 'text', label: '締めの一言（任意）', kind: 'text' }],
};

/* eslint-disable @typescript-eslint/no-explicit-any -- 場面の項目をパス（'left.label' など）で読み書きするため */
function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const copy: any = { ...(obj as any) };
  if (rest.length === 0) {
    if (value === undefined || value === '') delete copy[head];
    else copy[head] = value;
  } else {
    copy[head] = setPath(copy[head] ?? {}, rest.join('.'), value);
  }
  return copy;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function JsonField({ value, onChange, disabled }: { value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <textarea
        className="input mono"
        rows={5}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setError(null);
          } catch {
            setError('JSON の形が正しくありません（直すまで反映されません）');
          }
        }}
      />
      {error && <span className="notice ng">{error}</span>}
    </>
  );
}

function SceneFields({ scene, onChange, disabled }: { scene: Scene; onChange: (s: Scene) => void; disabled: boolean }) {
  return (
    <div className="scene-fields">
      {SCENE_FIELDS[scene.type].map((f) => {
        const value = getPath(scene, f.path);
        const set = (v: unknown) => onChange(setPath(scene, f.path, v));
        return (
          <label key={f.path} className="field">
            <span>{f.label}</span>
            {f.kind === 'text' && <input className="input" value={value ?? ''} disabled={disabled} onChange={(e) => set(e.target.value)} />}
            {f.kind === 'area' && <textarea className="input" rows={2} value={value ?? ''} disabled={disabled} onChange={(e) => set(e.target.value)} />}
            {f.kind === 'number' && (
              <input
                className="input"
                type="number"
                min={1}
                value={typeof value === 'number' ? value + 1 : ''}
                disabled={disabled}
                onChange={(e) => set(e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) - 1))}
              />
            )}
            {f.kind === 'list' && (
              <textarea className="input" rows={3} value={(value ?? []).join('\n')} disabled={disabled} onChange={(e) => set(e.target.value.split('\n'))} />
            )}
            {f.kind === 'steps' && (
              <textarea
                className="input"
                rows={3}
                value={((value ?? []) as { label: string; detail?: string }[]).map((s) => (s.detail ? `${s.label} | ${s.detail}` : s.label)).join('\n')}
                disabled={disabled}
                onChange={(e) =>
                  set(
                    e.target.value.split('\n').map((row) => {
                      const [label, ...detail] = row.split('|');
                      const d = detail.join('|').trim();
                      return d ? { label: label.trim(), detail: d } : { label: label.trim() };
                    })
                  )
                }
              />
            )}
            {f.kind === 'json' && <JsonField value={value} onChange={set} disabled={disabled} />}
          </label>
        );
      })}
    </div>
  );
}

function LineCard({
  index,
  total,
  line,
  disabled,
  onChange,
  onMove,
  onInsert,
  onRemove,
}: {
  index: number;
  total: number;
  line: ScriptLine;
  disabled: boolean;
  onChange: (l: ScriptLine) => void;
  onMove: (delta: -1 | 1) => void;
  onInsert: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="line-card">
      <div className="line-head">
        <strong>{index + 1}</strong>
        <span className="muted">{line.scene ? SCENE_LABEL[line.scene.type] : '場面は前の行のまま'}</span>
        <span className="spacer" />
        <button type="button" className="icon-btn sm" title="上へ" disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
        <button type="button" className="icon-btn sm" title="下へ" disabled={disabled || index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14} /></button>
        <button type="button" className="icon-btn sm" title="下に行を足す" disabled={disabled} onClick={onInsert}><Plus size={14} /></button>
        <button type="button" className="icon-btn sm danger" title="この行を消す" disabled={disabled || total <= 1} onClick={onRemove}><Trash2 size={14} /></button>
      </div>
      <label className="field">
        <span>字幕（改行で折り返す。1行 全角13字程度まで）</span>
        <textarea className="input" rows={2} value={line.caption ?? line.text} disabled={disabled} onChange={(e) => onChange({ ...line, caption: e.target.value })} />
      </label>
      <label className="field">
        <span>読み上げ（読み間違えやすい英語はカタカナに）</span>
        <input className="input" value={line.text} disabled={disabled} onChange={(e) => onChange({ ...line, text: e.target.value })} />
      </label>
      <div className="line-row">
        <label className="field">
          <span>場面</span>
          <select
            className="input"
            value={line.scene?.type ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const type = e.target.value as Scene['type'] | '';
              const next = { ...line };
              if (type) next.scene = line.scene?.type === type ? line.scene : EMPTY_SCENE[type];
              else delete next.scene;
              onChange(next);
            }}
          >
            <option value="">（前の行のまま）</option>
            {SCENE_TYPES.map((t) => <option key={t} value={t}>{SCENE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>表情</span>
          <select
            className="input"
            value={line.mood ?? ''}
            disabled={disabled}
            onChange={(e) => {
              const next = { ...line };
              if (e.target.value) next.mood = e.target.value as Mood;
              else delete next.mood;
              onChange(next);
            }}
          >
            <option value="">（前の行のまま）</option>
            {MOODS.map((m) => <option key={m} value={m}>{MOOD_LABEL[m]}</option>)}
          </select>
        </label>
      </div>
      {line.scene && <SceneFields scene={line.scene} disabled={disabled} onChange={(scene) => onChange({ ...line, scene })} />}
      <label className="field">
        <span>強調する語（読点「、」区切り）</span>
        <input
          className="input"
          value={(line.emphasis ?? []).join('、')}
          disabled={disabled}
          onChange={(e) => {
            const words = e.target.value.split(/[、,]/).map((w) => w.trim()).filter(Boolean);
            const next = { ...line };
            if (words.length > 0) next.emphasis = words;
            else delete next.emphasis;
            onChange(next);
          }}
        />
      </label>
    </div>
  );
}

export function LinesEditor({ lines, disabled, onChange }: { lines: ScriptLine[]; disabled: boolean; onChange: (lines: ScriptLine[]) => void }) {
  const update = (i: number, line: ScriptLine) => onChange(lines.map((l, j) => (j === i ? line : l)));
  const move = (i: number, delta: -1 | 1) => {
    const next = [...lines];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    onChange(next);
  };
  const insert = (i: number) => onChange([...lines.slice(0, i + 1), { text: '' }, ...lines.slice(i + 1)]);
  const remove = (i: number) => onChange(lines.filter((_, j) => j !== i));
  return (
    <div className="lines-editor">
      {lines.map((line, i) => (
        <LineCard
          // 並べ替えても入力中の欄がずれないよう、行の中身ではなく位置で区別する（JSON 欄は中身が変わると作り直す）
          key={`${i}-${line.scene?.type ?? ''}`}
          index={i}
          total={lines.length}
          line={line}
          disabled={disabled}
          onChange={(l) => update(i, l)}
          onMove={(d) => move(i, d)}
          onInsert={() => insert(i)}
          onRemove={() => remove(i)}
        />
      ))}
      <button type="button" className="btn" disabled={disabled} onClick={() => onChange([...lines, { text: '' }])}>
        <Plus size={14} />
        行を足す
      </button>
    </div>
  );
}
