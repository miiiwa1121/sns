'use client';

import React, { useState, useEffect } from 'react';
import { VideoProject, HighlightClip } from '@/lib/types';
import { VideoPlayerMock } from './VideoPlayerMock';
import { Film, Scissors, Mic, Layers, ArrowRight, Sparkles, CheckCircle2, Clock, Music } from 'lucide-react';

interface StudioViewProps {
  projects: VideoProject[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onProceedToApproval: (projectId: string) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onProceedToApproval
}) => {
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const [selectedClipId, setSelectedClipId] = useState<string>('');

  useEffect(() => {
    if (currentProject?.shortClips && currentProject.shortClips.length > 0) {
      setSelectedClipId(currentProject.shortClips[0].id);
    }
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Film size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
        <p>制作中のプロジェクトが登録されていません。</p>
      </div>
    );
  }

  const activeClip = currentProject?.shortClips.find(c => c.id === selectedClipId) || currentProject?.shortClips[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Project Selector Bar */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Film size={20} color="var(--accent-indigo)" />
          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>制作中プロジェクト:</span>
          <select
            value={currentProject?.id}
            onChange={(e) => {
              onSelectProject(e.target.value);
              const p = projects.find(proj => proj.id === e.target.value);
              if (p?.shortClips[0]) setSelectedClipId(p.shortClips[0].id);
            }}
            style={{
              background: 'var(--bg-tertiary)',
              color: '#ffffff',
              border: '1px solid var(--border-subtle)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => onProceedToApproval(currentProject.id)}
          className="btn-primary"
          style={{ fontSize: '0.85rem', padding: '8px 16px' }}
        >
          <span>配信・承認画面へ進む</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Main Studio Dual Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* LEFT COLUMN: 長尺動画（Long-Form）マスター構成 & 台本 */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(255, 0, 51, 0.15)',
                color: '#ff4d6d',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                YouTube メイン長尺
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                総尺: {Math.floor(currentProject.longForm.duration / 60)}分 ({currentProject.longForm.duration}秒)
              </span>
            </div>
            <span className="badge badge-success">台本・音声レンダリング完了</span>
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>
            {currentProject.longForm.title}
          </h3>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
            {currentProject.concept}
          </p>

          {/* Script Sections Timeline */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)'
            }}>
              <span>チャプター & ナレーション構成 (ScriptMaster)</span>
              <span style={{ color: 'var(--accent-cyan)' }}>AI生成済み</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentProject.longForm.script.map((sec, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                      § {idx + 1}. {sec.section}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      約{sec.durationSec}秒
                    </span>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.45 }}>
                    「{sec.narration}」
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: 'var(--accent-indigo)'
                  }}>
                    <Layers size={13} />
                    <span>映像指示: {sec.visualCue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Synthesizer Status */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '20px' }}>
                <span className="audio-bar" />
                <span className="audio-bar" />
                <span className="audio-bar" />
                <span className="audio-bar" />
                <span className="audio-bar" />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>ナレーション音声合成: 完了</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Engine: VOICEVOX / Style-Bert-VITS2</div>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>同期OK</span>
          </div>
        </div>

        {/* RIGHT COLUMN: 切り抜きショート（9:16 Shorts / Reels / TikTok） */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scissors size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>AI自動切り抜きショート</h3>
            </div>
            <span className="badge badge-ai">Remotion 9:16</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            長尺動画のピークタイム（感情の起伏・重要フレーズ）をAIが自動検出し、縦型ショート動画へ変換しました。
          </p>

          {/* Short Clips Selector Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {currentProject.shortClips.map((clip) => {
              const isSelected = clip.id === selectedClipId;
              return (
                <button
                  key={clip.id}
                  onClick={() => setSelectedClipId(clip.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--bg-tertiary)' : 'rgba(0, 0, 0, 0.2)',
                    border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '2px' }}>
                      {clip.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      切り抜き区間: {clip.startTime}秒〜{clip.endTime}秒 ({clip.duration}秒)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                      維持率予測 {clip.estimatedRetentionRate}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      スタイル: {clip.captionStyle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Smartphone Mock Player */}
          {activeClip ? (
            <VideoPlayerMock clip={activeClip} projectTitle={currentProject.title} />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              ショート動画が選択されていません
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
