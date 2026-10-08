'use client';

import React from 'react';
import { AgentLog } from '@/lib/types';
import { Terminal, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface AgentActivityTickerProps {
  logs: AgentLog[];
}

export const AgentActivityTicker: React.FC<AgentActivityTickerProps> = ({ logs }) => {
  return (
    <div className="glass-panel" style={{
      marginTop: '28px',
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--accent-indigo)',
        fontSize: '0.82rem',
        fontWeight: 700,
        flexShrink: 0
      }}>
        <Terminal size={16} />
        <span>Agent Activity Feed:</span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        width: '100%',
        scrollbarWidth: 'none'
      }}>
        {logs.map((log) => {
          const badgeColor = log.level === 'success' ? 'var(--accent-emerald)'
            : log.level === 'warning' ? 'var(--accent-amber)' : 'var(--accent-cyan)';

          return (
            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>[{log.timestamp}]</span>
              <span style={{
                background: 'rgba(255,255,255,0.08)',
                color: badgeColor,
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                {log.agentName}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {log.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
