import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLOR, FONT, SHADOW, fitFontSize } from '../theme';
import { ChatReply, Scene } from '../types';

// 場面はステージ（幅 STAGE_W × 高さ STAGE_H）の中に描く。
// 左下（マスコットが重なる位置）には大事な要素を置かない。絵文字・スタンプは使わず UI 部品で表現する
export const STAGE_W = 980;
export const STAGE_H = 800;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 170 } });
}

const center: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONT,
};

// 小さなラベル（UI のチップ）
const Chip: React.FC<{ children: React.ReactNode; strong?: boolean; size?: number }> = ({ children, strong, size = 32 }) => (
  <div
    style={{
      display: 'inline-block',
      fontSize: size,
      fontWeight: 800,
      color: strong ? COLOR.white : COLOR.primaryDeep,
      background: strong ? COLOR.primaryDeep : COLOR.primarySoft,
      borderRadius: 999,
      padding: '8px 26px',
    }}
  >
    {children}
  </div>
);

// ---------- hook ----------
const HookScene: React.FC<{ text: string; sub?: string }> = ({ text, sub }) => {
  const frame = useCurrentFrame();
  const enter = useEnter();
  const ring = interpolate(frame % 45, [0, 45], [0.6, 1.4]);
  return (
    <div style={{ ...center, paddingBottom: 110 }}>
      {/* 広がる輪（注意を引く動き） */}
      <div
        style={{
          position: 'absolute',
          width: 620,
          height: 620,
          borderRadius: '50%',
          border: `6px solid ${COLOR.primary}`,
          opacity: interpolate(ring, [0.6, 1.4], [0.35, 0]),
          transform: `scale(${ring})`,
          top: STAGE_H / 2 - 310 - 55,
        }}
      />
      {sub && <div style={{ marginBottom: 30, opacity: enter }}><Chip strong>{sub}</Chip></div>}
      <div
        style={{
          fontSize: fitFontSize(text, STAGE_W - 140, 64, 116),
          fontWeight: 900,
          color: COLOR.text,
          textAlign: 'center',
          lineHeight: 1.25,
          whiteSpace: 'pre-line',
          lineBreak: 'strict',
          transform: `scale(${0.85 + enter * 0.15})`,
          opacity: enter,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ---------- keyword ----------
const KeywordScene: React.FC<{ label?: string; text: string }> = ({ label, text }) => {
  const frame = useCurrentFrame();
  const enter = useEnter();
  const textEnter = useEnter(5);
  const underline = interpolate(frame, [10, 24], [0, 1], clamp);
  return (
    <div style={{ ...center, paddingBottom: 100 }}>
      {label && <div style={{ opacity: enter, marginBottom: 28 }}><Chip>{label}</Chip></div>}
      <div
        style={{
          fontSize: fitFontSize(text, STAGE_W - 140, 56, 112),
          fontWeight: 900,
          color: COLOR.text,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          lineHeight: 1.25,
          transform: `translateY(${(1 - textEnter) * 30}px)`,
          opacity: textEnter,
        }}
      >
        {text}
      </div>
      <div style={{ marginTop: 22, height: 10, width: 360 * underline, borderRadius: 5, background: COLOR.primary }} />
    </div>
  );
};

// ---------- compare ----------
const CompareScene: React.FC<{ left: { label: string; body: string }; right: { label: string; body: string } }> = ({ left, right }) => {
  const l = useEnter();
  const r = useEnter(12);
  const card = (side: { label: string; body: string }, highlight: boolean, t: number, from: number) => (
    <div
      style={{
        width: 410,
        height: 460,
        borderRadius: 32,
        background: highlight ? COLOR.surface : COLOR.surfaceSub,
        border: `4px solid ${highlight ? COLOR.primary : COLOR.border}`,
        boxShadow: highlight ? SHADOW : 'none',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateX(${(1 - t) * from}px)`,
        opacity: t,
      }}
    >
      <div style={{ marginBottom: 28 }}><Chip strong={highlight}>{side.label}</Chip></div>
      <div style={{ fontSize: fitFontSize(side.body, 320, 32, 60), fontWeight: 900, color: highlight ? COLOR.text : COLOR.muted, textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.35 }}>
        {side.body}
      </div>
    </div>
  );
  return (
    <div style={{ ...center, flexDirection: 'row', gap: 20, paddingBottom: 140 }}>
      {card(left, false, l, -300)}
      {/* 中央の矢印（UI の線で描く） */}
      <svg width={60} height={60} style={{ flexShrink: 0, opacity: r }}>
        <path d="M10 30 H48 M34 16 L48 30 L34 44" stroke={COLOR.primaryDeep} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {card(right, true, r, 300)}
    </div>
  );
};

// ---------- timeline ----------
const TimelineScene: React.FC<{ title?: string; steps: { label: string; detail?: string }[] }> = ({ title, steps }) => {
  const frame = useCurrentFrame();
  const per = 14;
  const progress = interpolate(frame, [8, 8 + per * Math.max(1, steps.length - 1)], [0, 1], clamp);
  const width = 640;
  return (
    <div style={{ ...center, paddingBottom: 120 }}>
      {title && <div style={{ fontSize: fitFontSize(title, STAGE_W - 140, 56, 104), fontWeight: 900, color: COLOR.text, marginBottom: 70 }}>{title}</div>}
      <div style={{ position: 'relative', width, height: 200 }}>
        <div style={{ position: 'absolute', top: 28, left: 0, right: 0, height: 8, borderRadius: 4, background: COLOR.border }} />
        <div style={{ position: 'absolute', top: 28, left: 0, width: width * progress, height: 8, borderRadius: 4, background: COLOR.primary }} />
        {steps.map((s, i) => {
          const x = steps.length === 1 ? width / 2 : (width / (steps.length - 1)) * i;
          const on = interpolate(frame, [8 + per * i - 2, 8 + per * i + 4], [0, 1], clamp);
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 320 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: on > 0.5 ? COLOR.primaryDeep : COLOR.surface, border: `6px solid ${on > 0.5 ? COLOR.primaryDeep : COLOR.border}`, boxShadow: on > 0.5 ? SHADOW : 'none', transform: `scale(${0.8 + on * 0.2})` }} />
              <div style={{ marginTop: 20, fontSize: 44, fontWeight: 900, color: on > 0.5 ? COLOR.text : COLOR.muted }}>{s.label}</div>
              {s.detail && <div style={{ marginTop: 6, fontSize: 32, fontWeight: 700, color: on > 0.5 ? COLOR.primaryDeep : COLOR.muted }}>{s.detail}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- chips ----------
const ChipsScene: React.FC<{ title?: string; items: string[] }> = ({ title, items }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...center, padding: '0 70px 120px' }}>
      {title && <div style={{ fontSize: fitFontSize(title, STAGE_W - 140, 44, 72), fontWeight: 900, color: COLOR.text, marginBottom: 44 }}>{title}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center' }}>
        {items.map((item, i) => {
          const t = interpolate(frame, [4 + i * 5, 12 + i * 5], [0, 1], clamp);
          return (
            <div
              key={i}
              style={{
                fontSize: 46,
                fontWeight: 800,
                color: COLOR.text,
                background: COLOR.surface,
                border: `4px solid ${COLOR.primary}`,
                borderRadius: 999,
                padding: '16px 40px',
                boxShadow: SHADOW,
                opacity: t,
                transform: `translateY(${(1 - t) * 24}px) scale(${0.9 + t * 0.1})`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- select ----------
const SelectScene: React.FC<{ title?: string; options: string[]; selected?: number }> = ({ title, options, selected }) => {
  const frame = useCurrentFrame();
  const finalIndex = selected ?? options.length - 1;
  // 候補を順に試すように動き、最後に選ばれた1つで止まる
  const settleAt = 8 * (options.length + 2);
  const settled = frame >= settleAt;
  const current = settled ? finalIndex : Math.floor(frame / 8) % options.length;
  return (
    <div style={{ ...center, paddingBottom: 130 }}>
      {title && <div style={{ fontSize: fitFontSize(title, STAGE_W - 140, 44, 72), fontWeight: 900, color: COLOR.text, marginBottom: 44 }}>{title}</div>}
      <div style={{ display: 'flex', background: COLOR.surfaceSub, border: `3px solid ${COLOR.border}`, borderRadius: 28, padding: 10, gap: 8 }}>
        {options.map((o, i) => (
          <div
            key={i}
            style={{
              fontSize: 44,
              fontWeight: 900,
              padding: '20px 34px',
              borderRadius: 20,
              color: i === current ? COLOR.white : COLOR.sub,
              background: i === current ? COLOR.primaryDeep : 'transparent',
              boxShadow: i === current ? SHADOW : 'none',
            }}
          >
            {o}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 34, height: 50, fontSize: 34, fontWeight: 800, color: COLOR.primaryDeep, opacity: settled ? 1 : 0.5 }}>
        {settled ? 'AIが自動で選択' : '選んでいます…'}
      </div>
    </div>
  );
};

// ---------- chat ----------
const ChatReplyView: React.FC<{ reply: ChatReply; t: number }> = ({ reply, t }) => {
  // t: 返答が出始めてからのフレーム数
  switch (reply.type) {
    case 'text': {
      const shown = Math.floor(interpolate(t, [0, 30], [0, reply.text.length], clamp));
      return <div style={{ fontSize: 40, lineHeight: 1.5, color: COLOR.text, background: COLOR.surfaceSub, borderRadius: 24, padding: '18px 26px' }}>{reply.text.slice(0, shown)}</div>;
    }
    case 'table':
      return (
        <div style={{ width: 860, borderRadius: 18, overflow: 'hidden', border: `3px solid ${COLOR.border}`, background: COLOR.surface }}>
          <div style={{ display: 'flex', background: COLOR.primarySoft, color: COLOR.primaryDeep, fontWeight: 900, fontSize: 32 }}>
            {reply.headers.map((h, i) => (
              <div key={i} style={{ flex: i === 0 ? 1.2 : 1, padding: '14px 18px', whiteSpace: 'nowrap' }}>{h}</div>
            ))}
          </div>
          {reply.rows.map((row, ri) => {
            const o = interpolate(t, [6 + ri * 6, 12 + ri * 6], [0, 1], clamp);
            return (
              <div key={ri} style={{ display: 'flex', fontSize: 30, color: COLOR.text, borderTop: `2px solid ${COLOR.border}`, opacity: o, transform: `translateY(${(1 - o) * 20}px)` }}>
                {row.map((c, ci) => (
                  <div key={ci} style={{ flex: ci === 0 ? 1.2 : 1, padding: '14px 18px', fontWeight: ci === 0 ? 800 : 600, color: ci === 0 ? COLOR.sub : COLOR.text, whiteSpace: 'nowrap' }}>{c}</div>
                ))}
              </div>
            );
          })}
        </div>
      );
    case 'bill': {
      // ステージ（高さ 800）に結果まで収まるよう、入力欄は横並びにする
      const pressed = t > 18 && t < 26;
      const per = Math.round(reply.total / reply.people);
      const count = Math.round(interpolate(t, [24, 42], [0, per], clamp));
      const field = (label: string, value: string, delay: number) => (
        <div style={{ flex: 1, background: COLOR.surfaceSub, border: `2px solid ${COLOR.border}`, borderRadius: 14, padding: '10px 18px', opacity: interpolate(t, [delay, delay + 6], [0, 1], clamp) }}>
          <div style={{ color: COLOR.sub, fontSize: 26, fontWeight: 700 }}>{label}</div>
          <div style={{ color: COLOR.text, fontSize: 40, fontWeight: 900 }}>{value}</div>
        </div>
      );
      return (
        <div style={{ background: COLOR.surface, borderRadius: 24, padding: 24, border: `3px solid ${COLOR.primary}`, boxShadow: SHADOW, width: 640 }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: COLOR.primaryDeep, marginBottom: 14 }}>割り勘ツール</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            {field('合計', `¥${reply.total.toLocaleString()}`, 0)}
            {field('人数', `${reply.people}人`, 6)}
          </div>
          <div style={{ textAlign: 'center', background: COLOR.primaryDeep, color: COLOR.white, fontWeight: 900, fontSize: 32, borderRadius: 14, padding: '10px 0', transform: `scale(${pressed ? 0.94 : 1})`, filter: pressed ? 'brightness(0.85)' : 'none', opacity: interpolate(t, [10, 16], [0, 1], clamp) }}>
            計算する
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 16, opacity: interpolate(t, [24, 28], [0, 1], clamp) }}>
            <span style={{ fontSize: 30, color: COLOR.sub, fontWeight: 700 }}>1人あたり</span>
            <span style={{ fontSize: 76, fontWeight: 900, color: COLOR.text }}>¥{count.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    case 'chart': {
      const max = Math.max(...reply.bars.map((b) => b.value), 1);
      return (
        <div style={{ background: COLOR.surface, border: `3px solid ${COLOR.border}`, borderRadius: 24, padding: 26, width: 640 }}>
          {reply.title && <div style={{ fontSize: 32, fontWeight: 800, color: COLOR.sub, marginBottom: 16 }}>{reply.title}</div>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, height: 300 }}>
            {reply.bars.map((b, i) => {
              const h = interpolate(t, [i * 5, i * 5 + 18], [0, (b.value / max) * 260], clamp);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', height: h, background: i === reply.bars.length - 1 ? COLOR.primaryDeep : COLOR.primary, borderRadius: '12px 12px 0 0' }} />
                  <div style={{ marginTop: 10, fontSize: 28, color: COLOR.text, fontWeight: 700 }}>{b.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case 'calculator': {
      const showResult = t > 24;
      return (
        <div style={{ background: COLOR.surface, borderRadius: 24, padding: 30, width: 560, border: `3px solid ${COLOR.primary}`, boxShadow: SHADOW }}>
          <div style={{ fontSize: 30, color: COLOR.primaryDeep, fontWeight: 800 }}>計算機</div>
          <div style={{ marginTop: 16, fontSize: 44, color: COLOR.sub, fontWeight: 800, textAlign: 'right' }}>{reply.expression}</div>
          <div style={{ marginTop: 8, fontSize: 80, color: COLOR.text, fontWeight: 900, textAlign: 'right', opacity: showResult ? 1 : 0 }}>= {reply.result}</div>
        </div>
      );
    }
  }
};

const ChatScene: React.FC<{ user: string; reply: ChatReply }> = ({ user, reply }) => {
  const frame = useCurrentFrame();
  const typed = Math.floor(interpolate(frame, [3, 15], [0, user.length], clamp));
  const thinking = frame > 15 && frame < 27;
  const replyT = frame - 27;
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '28px 44px', fontFamily: FONT }}>
      {/* チャットアプリのヘッダー（特定サービスの UI は使わず汎用の見た目にする） */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: `2px solid ${COLOR.border}`, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: COLOR.primarySoft, color: COLOR.primaryDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900 }}>AI</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: COLOR.text }}>AIチャット</div>
        {/* 実際のサービス画面ではなく再現であることを明示する */}
        <div style={{ marginLeft: 'auto', fontSize: 26, color: COLOR.muted, fontWeight: 700 }}>※イメージ</div>
      </div>
      {/* ユーザーの質問 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ maxWidth: 680, background: COLOR.primaryDeep, color: COLOR.white, fontSize: 36, fontWeight: 800, padding: '16px 26px', borderRadius: '28px 28px 6px 28px', minHeight: 40 }}>
          {user.slice(0, typed)}
          {typed < user.length && <span style={{ opacity: frame % 10 < 5 ? 1 : 0 }}>|</span>}
        </div>
      </div>
      {/* AIの返答 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        {thinking && (
          <div style={{ background: COLOR.surfaceSub, borderRadius: 28, padding: '20px 30px', display: 'flex', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: COLOR.primary, transform: `translateY(${Math.sin((frame + i * 4) / 3) * 6}px)` }} />
            ))}
          </div>
        )}
        {replyT >= 0 && (
          <div style={{ opacity: interpolate(replyT, [0, 6], [0, 1], clamp), transform: `translateY(${interpolate(replyT, [0, 8], [30, 0], clamp)}px)`, marginLeft: 'auto', marginRight: 'auto' }}>
            <ChatReplyView reply={reply} t={replyT} />
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- outro ----------
const OutroScene: React.FC<{ brandName: string; text?: string }> = ({ brandName, text }) => {
  const frame = useCurrentFrame();
  const enter = useEnter();
  return (
    <div style={center}>
      <Img
        src={staticFile('brand/icon-512.png')}
        style={{ width: 300, height: 300, borderRadius: '50%', transform: `scale(${enter}) translateY(${Math.sin(frame / 8) * 6}px)`, boxShadow: `0 0 0 10px ${COLOR.primarySoft}, ${SHADOW}` }}
      />
      <div style={{ marginTop: 44, fontSize: 68, fontWeight: 900, color: COLOR.text, opacity: enter }}>{brandName}</div>
      {text && (
        <div style={{ marginTop: 24, opacity: interpolate(frame, [12, 22], [0, 1], clamp) }}>
          <Chip strong size={36}>{text}</Chip>
        </div>
      )}
    </div>
  );
};

export const SceneView: React.FC<{ scene: Scene; brandName: string }> = ({ scene, brandName }) => {
  switch (scene.type) {
    case 'hook':
      return <HookScene text={scene.text} sub={scene.sub} />;
    case 'keyword':
      return <KeywordScene label={scene.label} text={scene.text} />;
    case 'compare':
      return <CompareScene left={scene.left} right={scene.right} />;
    case 'chat':
      return <ChatScene user={scene.user} reply={scene.reply} />;
    case 'timeline':
      return <TimelineScene title={scene.title} steps={scene.steps} />;
    case 'chips':
      return <ChipsScene title={scene.title} items={scene.items} />;
    case 'select':
      return <SelectScene title={scene.title} options={scene.options} selected={scene.selected} />;
    case 'outro':
      return <OutroScene brandName={brandName} text={scene.text} />;
  }
};
