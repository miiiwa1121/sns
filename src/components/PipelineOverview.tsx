'use client';

import React from 'react';
import { Compass, Film, Send, LineChart, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export type ActiveTab = 'research' | 'studio' | 'approval' | 'analytics';

interface PipelineOverviewProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  stats: {
    activeProjects: number;
    totalViews: string;
    avgEngagement: string;
    pendingApprovals: number;
  };
}

export const PipelineOverview: React.FC<PipelineOverviewProps> = ({
  activeTab,
  onTabChange,
  stats
}) => {
  const steps = [
    {
      id: 'research' as ActiveTab,
      label: '1. リサーチ & 企画',
      desc: 'トレンド収集 & バズ予測',
      icon: Compass,
      count: '3 トピック'
    },
    {
      id: 'studio' as ActiveTab,
      label: '2. 長尺 & 切り抜き制作',
      desc: '台本構成・縦型リフレーム',
      icon: Film,
      count: '2 プロジェクト'
    },
    {
      id: 'approval' as ActiveTab,
      label: '3. 承認 & マルチ配信',
      desc: 'YouTube / TikTok / IG / X',
      icon: Send,
      count: `${stats.pendingApprovals}件 承認待ち`
    },
    {
      id: 'analytics' as ActiveTab,
      label: '4. アナリティクス & PDCA',
      desc: 'AI要因分析 & フィードバック',
      icon: LineChart,
      count: '学習済み'
    }
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Quick KPI stats strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            SNS合算総再生数
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800 }} className="text-gradient-cyan">
              {stats.totalViews}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {stats.totalViews === '0 回' ? '(未配信・未集計)' : '(DB記録値)'}
            </span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            平均視聴維持率
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800 }} className="text-gradient-ai">
              {stats.avgEngagement}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {stats.avgEngagement === '-' ? '(データなし)' : '(DB記録値)'}
            </span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            パイプライン稼働中
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
              {stats.activeProjects} 件
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>長尺 + ショート</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            ワンクリック承認待ち
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: stats.pendingApprovals > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
              {stats.pendingApprovals} 本
            </span>
            {stats.pendingApprovals > 0 && (
              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>確認推奨</span>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Stepper Navigation */}
      <div className="glass-panel" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '8px',
        gap: '8px'
      }}>
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeTab === step.id;
          return (
            <button
              key={step.id}
              onClick={() => onTabChange(step.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 20px rgba(99, 102, 241, 0.2)' : 'none'
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isActive ? 'var(--grad-ai)' : 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={19} color={isActive ? '#ffffff' : 'var(--text-muted)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {step.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
