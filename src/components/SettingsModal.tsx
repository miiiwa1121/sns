'use client';

import React, { useState } from 'react';
import { X, Key, Cpu, Clock, CheckCircle2, Shield, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PlatformTab = 'youtube' | 'tiktok' | 'instagram' | 'x';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activePlatform, setActivePlatform] = useState<PlatformTab>('youtube');
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [ttsEngine, setTtsEngine] = useState<string>('edge-tts');
  const [cronTime, setCronTime] = useState<string>('0 19 * * *');

  // YouTube API Credentials
  const [ytClientId, setYtClientId] = useState<string>('');
  const [ytClientSecret, setYtClientSecret] = useState<string>('');
  const [ytRefreshToken, setYtRefreshToken] = useState<string>('');

  // TikTok API Credentials
  const [tiktokAccessToken, setTiktokAccessToken] = useState<string>('');
  const [tiktokUsername, setTiktokUsername] = useState<string>('ai_pulse_lab');

  // Instagram Graph API Credentials
  const [igAccessToken, setIgAccessToken] = useState<string>('');
  const [igAccountId, setIgAccountId] = useState<string>('');

  // X (Twitter) API Credentials
  const [xApiKey, setXApiKey] = useState<string>('');
  const [xApiSecret, setXApiSecret] = useState<string>('');
  const [xAccessToken, setXAccessToken] = useState<string>('');
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState<string>('');

  const [saved, setSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        position: 'relative',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Shield size={22} color="var(--accent-indigo)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>システム & 各SNS API設定</h2>
        </div>

        {/* SNS Platform Sub-Tabs */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            マルチSNS 自動投稿 API設定
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            <button
              onClick={() => setActivePlatform('youtube')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activePlatform === 'youtube' ? '#ff0033' : 'var(--border-subtle)',
                background: activePlatform === 'youtube' ? 'rgba(255, 0, 51, 0.15)' : 'rgba(0,0,0,0.3)',
                color: activePlatform === 'youtube' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              YouTube
            </button>
            <button
              onClick={() => setActivePlatform('tiktok')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activePlatform === 'tiktok' ? '#00f2fe' : 'var(--border-subtle)',
                background: activePlatform === 'tiktok' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(0,0,0,0.3)',
                color: activePlatform === 'tiktok' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              TikTok
            </button>
            <button
              onClick={() => setActivePlatform('instagram')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activePlatform === 'instagram' ? '#e1306c' : 'var(--border-subtle)',
                background: activePlatform === 'instagram' ? 'rgba(225, 48, 108, 0.15)' : 'rgba(0,0,0,0.3)',
                color: activePlatform === 'instagram' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Instagram
            </button>
            <button
              onClick={() => setActivePlatform('x')}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activePlatform === 'x' ? '#ffffff' : 'var(--border-subtle)',
                background: activePlatform === 'x' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0,0,0,0.3)',
                color: activePlatform === 'x' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              X (Twitter)
            </button>
          </div>
        </div>

        {/* YouTube Config Box */}
        {activePlatform === 'youtube' && (
          <div style={{
            background: 'rgba(255, 0, 51, 0.05)',
            border: '1px solid rgba(255, 0, 51, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff4d6d', marginBottom: '8px' }}>
              YouTube Data API v3 (OAuth2)
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Google Cloud Console の OAuth2 認証情報を設定すると、実チャンネルへ自動アップロードされます（未設定時はシミュレーションモード）。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Client ID</label>
                <input
                  type="text"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={ytClientId}
                  onChange={(e) => setYtClientId(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Client Secret</label>
                <input
                  type="password"
                  placeholder="GOCSPX-xxxx"
                  value={ytClientSecret}
                  onChange={(e) => setYtClientSecret(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Refresh Token</label>
                <input
                  type="password"
                  placeholder="1//xxxx"
                  value={ytRefreshToken}
                  onChange={(e) => setYtRefreshToken(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TikTok Config Box */}
        {activePlatform === 'tiktok' && (
          <div style={{
            background: 'rgba(0, 242, 254, 0.05)',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              TikTok Content Posting API (Direct Post)
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              TikTok for Developers で発行したアクセストークンを設定します（未設定時はシミュレーションモード）。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Creator Username</label>
                <input
                  type="text"
                  placeholder="ai_pulse_lab"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Access Token</label>
                <input
                  type="password"
                  placeholder="act.xxxx"
                  value={tiktokAccessToken}
                  onChange={(e) => setTiktokAccessToken(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Instagram Config Box */}
        {activePlatform === 'instagram' && (
          <div style={{
            background: 'rgba(225, 48, 108, 0.05)',
            border: '1px solid rgba(225, 48, 108, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f472b6', marginBottom: '8px' }}>
              Instagram Graph API (Reels Publishing)
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Meta for Developers で発行した Instagram プロアカウントIDおよび長期間アクセストークンを設定します。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Instagram Business Account ID</label>
                <input
                  type="text"
                  placeholder="17841400000000000"
                  value={igAccountId}
                  onChange={(e) => setIgAccountId(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>User / Page Access Token</label>
                <input
                  type="password"
                  placeholder="EAAGxxxx"
                  value={igAccessToken}
                  onChange={(e) => setIgAccessToken(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* X (Twitter) Config Box */}
        {activePlatform === 'x' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              X (Twitter) Developer Portal (API v2)
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              X Developer Portal の OAuth 1.0a (Read and Write) キーおよびトークンを設定します。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>API Key (Consumer Key)</label>
                <input
                  type="text"
                  placeholder="API Key"
                  value={xApiKey}
                  onChange={(e) => setXApiKey(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>API Key Secret</label>
                <input
                  type="password"
                  placeholder="API Secret"
                  value={xApiSecret}
                  onChange={(e) => setXApiSecret(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Access Token</label>
                <input
                  type="text"
                  placeholder="Access Token"
                  value={xAccessToken}
                  onChange={(e) => setXAccessToken(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>Access Token Secret</label>
                <input
                  type="password"
                  placeholder="Token Secret"
                  value={xAccessTokenSecret}
                  onChange={(e) => setXAccessTokenSecret(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* AI Model Selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            自律エージェント推論モデル
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              fontSize: '0.85rem'
            }}
          >
            <option value="gemini-3.8-flash">Gemini 3.8 Flash (現在稼働中・直接推論)</option>
            <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (高品質日本語台本)</option>
            <option value="qwen2.5:7b">Qwen 2.5 7B (完全ローカル Ollama)</option>
          </select>
        </div>

        {/* TTS Engine */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            音声合成エンジン (TTS)
          </label>
          <select
            value={ttsEngine}
            onChange={(e) => setTtsEngine(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              fontSize: '0.85rem'
            }}
          >
            <option value="edge-tts">Microsoft ニューラル音声 (Nanami / 高音質無料)</option>
            <option value="voicevox">VOICEVOX (ローカル無料 / ずんだもん等)</option>
            <option value="elevenlabs">ElevenLabs API (商用最高峰)</option>
          </select>
        </div>

        {/* Autonomous Schedule */}
        <div style={{ marginBottom: '22px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            自動トレンドスキャン & 投稿スケジュール (Cron)
          </label>
          <input
            type="text"
            value={cronTime}
            onChange={(e) => setCronTime(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontFamily: 'monospace'
            }}
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} />
              <span>設定を保存しました</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>設定を保存</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
