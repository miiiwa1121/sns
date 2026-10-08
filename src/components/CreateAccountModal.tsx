'use client';

import React, { useState } from 'react';
import { X, Plus, Sparkles, Building2, Target, MessageSquare, Link2 } from 'lucide-react';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (newAccount: any) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('AI・IT');
  const [concept, setConcept] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('親しみやすく論理的');
  const [systemPromptRules, setSystemPromptRules] = useState('');

  // 実在SNSアカウント情報
  const [youtubeHandle, setYoutubeHandle] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !concept) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          concept,
          targetAudience,
          toneOfVoice,
          systemPromptRules,
          youtubeHandle,
          xHandle,
          tiktokHandle,
          instagramHandle,
        }),
      });

      const data = await res.json();
      if (data.success && data.account) {
        onAccountCreated(data.account);
        onClose();
        setName('');
        setConcept('');
        setTargetAudience('');
        setYoutubeHandle('');
        setXHandle('');
        setTiktokHandle('');
        setInstagramHandle('');
      }
    } catch (err) {
      console.error('Failed to create account:', err);
    } finally {
      setIsSubmitting(false);
    }
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
      zIndex: 110,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '620px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        position: 'relative',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)'
      }}>
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
          <Building2 size={24} color="var(--accent-indigo)" />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>実在チャンネル / アカウント登録</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              あなたが運用する実在のSNSアカウント情報を登録します（SQLite DBに完全ローカル永続化）
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              アカウント / チャンネル名 *
            </label>
            <input
              type="text"
              placeholder="例: 私のAI活用ラボ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                カテゴリ
              </label>
              <input
                type="text"
                placeholder="例: AI・IT, ビジネス, エンタメ"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                トーン＆マナー
              </label>
              <input
                type="text"
                placeholder="例: 親しみやすい、論理的"
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              チャンネルコンセプト / 発信テーマ *
            </label>
            <textarea
              placeholder="例: 最新のAIツールの活用法をわかりやすく解説し、仕事の生産性を高めるノウハウを届ける"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              required
              rows={2}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                fontSize: '0.88rem',
                resize: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              ターゲット視聴者層 (ペルソナ)
            </label>
            <input
              type="text"
              placeholder="例: 20〜40代のITビジネスパーソン、AIに興味がある初心者"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                fontSize: '0.88rem'
              }}
            />
          </div>

          {/* 実在SNSアカウント連携セクション */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 700 }}>
              <Link2 size={16} />
              <span>実在SNSアカウント連携（投稿先URL・ハンドル名）</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              動画完成後のワンクリック実投稿リンク先として使われます。アカウントがまだ無いSNSは空欄で構いません。
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#ff4d6d', fontWeight: 600, marginBottom: '3px' }}>
                  YouTube チャンネルURL / ハンドル
                </label>
                <input
                  type="text"
                  placeholder="@MyChannel または https://youtube.com/..."
                  value={youtubeHandle}
                  onChange={(e) => setYoutubeHandle(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffffff', fontWeight: 600, marginBottom: '3px' }}>
                  X (Twitter) ハンドル
                </label>
                <input
                  type="text"
                  placeholder="@my_twitter_handle"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '3px' }}>
                  TikTok ユーザー名
                </label>
                <input
                  type="text"
                  placeholder="@my_tiktok"
                  value={tiktokHandle}
                  onChange={(e) => setTiktokHandle(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#f472b6', fontWeight: 600, marginBottom: '3px' }}>
                  Instagram プロフィールURL
                </label>
                <input
                  type="text"
                  placeholder="https://instagram.com/my_profile"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', padding: '7px 10px', borderRadius: '6px', color: '#fff', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ fontSize: '0.88rem' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !name || !concept}
              style={{ fontSize: '0.88rem' }}
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? '登録中...' : '実在チャンネルを登録して開始'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
