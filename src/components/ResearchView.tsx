'use client';

import React, { useState } from 'react';
import { TrendItem, PlatformType } from '@/lib/types';
import { Flame, TrendingUp, Sparkles, Plus, ArrowRight, Share2, Check } from 'lucide-react';

interface ResearchViewProps {
  trends: TrendItem[];
  onSelectTrendToProduce: (trend: TrendItem) => void;
  isGenerating: boolean;
}

export const ResearchView: React.FC<ResearchViewProps> = ({
  trends,
  onSelectTrendToProduce,
  isGenerating
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const categories = ['all', ...Array.from(new Set(trends.map(t => t.category).filter(Boolean)))];

  const filteredTrends = selectedCategory === 'all'
    ? trends
    : trends.filter(t => t.category === selectedCategory);

  const renderPlatformBadge = (p: PlatformType) => {
    switch (p) {
      case 'youtube':
        return (
          <span key={p} style={{
            background: 'rgba(255, 0, 51, 0.15)',
            color: '#ff4d6d',
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 600
          }}>
            YouTube
          </span>
        );
      case 'tiktok':
        return (
          <span key={p} style={{
            background: 'rgba(0, 242, 254, 0.15)',
            color: '#38bdf8',
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 600
          }}>
            TikTok
          </span>
        );
      case 'instagram':
        return (
          <span key={p} style={{
            background: 'rgba(225, 48, 108, 0.15)',
            color: '#f472b6',
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 600
          }}>
            Instagram
          </span>
        );
      case 'x':
        return (
          <span key={p} style={{
            background: 'rgba(29, 155, 240, 0.15)',
            color: '#60a5fa',
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 600
          }}>
            X
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Category filter and status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="btn-secondary"
              style={{
                fontSize: '0.82rem',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: selectedCategory === cat ? 'var(--grad-ai)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: selectedCategory === cat ? 'transparent' : 'var(--border-subtle)',
                color: selectedCategory === cat ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              {cat === 'all' ? 'すべてのカテゴリー' : cat}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          🔍 AI Agent TrendScout が自動収集したリアルタイム候補
        </div>
      </div>

      {/* Trend Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {filteredTrends.map(trend => (
          <div
            key={trend.id}
            className="glass-panel glass-panel-hover"
            style={{
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              {/* Card Header: Category & Buzz Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="badge badge-ai">{trend.category}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Flame size={16} color="var(--accent-amber)" />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent-amber)' }}>
                    Buzz {trend.buzzScore ?? '-'}/100
                  </span>
                </div>
              </div>

              {/* Title / Topic */}
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px', lineHeight: 1.4 }}>
                {trend.topic}
              </h3>

              {/* Suggested Angle / Hook */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '4px' }}>
                  💡 AI推薦のバズる切り口
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {trend.suggestedAngle}
                </div>
              </div>

              {/* Metrics pill */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>
                  検索ボリューム: <strong style={{ color: 'var(--text-main)' }}>{trend.searchVolume ?? '-'}</strong>
                </div>
                <div>
                  急上昇速度: <strong style={{ color: 'var(--accent-emerald)' }}>{trend.trendVelocity ?? '-'}</strong>
                </div>
              </div>

              {/* Target Platforms */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>適性SNS:</span>
                {trend.platforms.map(p => renderPlatformBadge(p))}
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={() => onSelectTrendToProduce(trend)}
              className="btn-primary"
              disabled={isGenerating}
              style={{ width: '100%' }}
            >
              <Sparkles size={16} />
              <span>この企画で動画制作を開始 (長尺 & 切り抜き)</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
