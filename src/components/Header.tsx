'use client';

import React from 'react';
import { Bot, Sparkles, Activity, ShieldCheck, Zap, Sliders, PlayCircle } from 'lucide-react';

interface HeaderProps {
  accounts: any[];
  currentAccountId: string;
  onSelectAccount: (id: string) => void;
  onOpenCreateAccount: () => void;
  autonomousMode: boolean;
  onToggleAutonomous: () => void;
  onOpenSettings: () => void;
  onTriggerNewResearch: () => void;
  isGenerating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  accounts,
  currentAccountId,
  onSelectAccount,
  onOpenCreateAccount,
  autonomousMode,
  onToggleAutonomous,
  onOpenSettings,
  onTriggerNewResearch,
  isGenerating
}) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Brand & Account Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--grad-ai)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
          }}>
            <Bot size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                OmniPulse <span className="text-gradient-ai">Studio</span>
              </span>
              <span className="badge badge-ai" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>SQLite</span>
            </div>
          </div>
        </div>

        {/* Multi-Account Selector Divider */}
        <div style={{ height: '24px', width: '1px', background: 'var(--border-subtle)' }} />

        {/* Account Selector Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>運用アカウント:</span>
          <select
            value={currentAccountId}
            onChange={(e) => onSelectAccount(e.target.value)}
            style={{
              background: 'var(--bg-tertiary)',
              color: '#ffffff',
              border: '1px solid var(--border-glow)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 700,
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
            }}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                📺 {acc.name} ({acc.category})
              </option>
            ))}
          </select>

          <button
            onClick={onOpenCreateAccount}
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            title="新しいチャンネル/アカウントを追加"
          >
            + チャンネル追加
          </button>
        </div>
      </div>

      {/* Autonomous Mode Toggle & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Agent Live Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '9999px',
          fontSize: '0.82rem'
        }}>
          <span className="pulse-indicator" style={{
            background: autonomousMode ? 'var(--accent-emerald)' : 'var(--accent-amber)'
          }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            AI Agent: <strong style={{ color: '#ffffff' }}>{autonomousMode ? '自律稼働中 (Auto-Pilot)' : '承認待ちモード (Human-in-Loop)'}</strong>
          </span>
        </div>

        {/* Mode Switch Toggle Button */}
        <button
          onClick={onToggleAutonomous}
          className="btn-secondary"
          style={{
            borderColor: autonomousMode ? 'var(--accent-emerald)' : 'var(--border-subtle)',
            background: autonomousMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)'
          }}
          title="完全自律モードと人間承認モードを切り替えます"
        >
          {autonomousMode ? (
            <>
              <Zap size={16} color="var(--accent-emerald)" />
              <span style={{ color: 'var(--accent-emerald)' }}>完全自律 ON</span>
            </>
          ) : (
            <>
              <ShieldCheck size={16} color="var(--accent-indigo)" />
              <span>承認制モード</span>
            </>
          )}
        </button>

        {/* Generate / Scout Button */}
        <button
          onClick={onTriggerNewResearch}
          className="btn-primary"
          disabled={isGenerating}
          style={{ opacity: isGenerating ? 0.7 : 1 }}
        >
          {isGenerating ? (
            <>
              <Activity size={17} className="animate-spin" />
              <span>AIリサーチ＆企画中...</span>
            </>
          ) : (
            <>
              <Sparkles size={17} />
              <span>自律リサーチを実行</span>
            </>
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="btn-secondary"
          style={{ padding: '10px 12px' }}
          title="SNS APIキー & LLM設定"
        >
          <Sliders size={18} />
        </button>
      </div>
    </header>
  );
};
