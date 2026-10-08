'use client';

import React, { useState, useEffect } from 'react';
import { VideoProject } from '@/lib/types';
import { Send, CheckCircle2, Share2, Sparkles, Clock, Copy, Download, ExternalLink, Link2, Film } from 'lucide-react';

interface ApprovalViewProps {
  projects: VideoProject[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onPublishAll: (projectId: string) => void;
  isPublishing: boolean;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({
  projects,
  currentProjectId,
  onPublishAll,
  isPublishing
}) => {
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];

  const [activePlatformTab, setActivePlatformTab] = useState<'youtube' | 'tiktok' | 'instagram' | 'x'>('youtube');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Local state for metadata edits
  const [ytTitle, setYtTitle] = useState(currentProject?.publishingMetadata?.youtube?.title || '');
  const [ttCaption, setTtCaption] = useState(currentProject?.publishingMetadata?.tiktok?.caption || '');
  const [igCaption, setIgCaption] = useState(currentProject?.publishingMetadata?.instagram?.caption || '');
  const [xText, setXText] = useState(currentProject?.publishingMetadata?.x?.postText || '');

  // プロジェクト切り替え時にメタデータを最新DB状態と同期
  useEffect(() => {
    if (currentProject) {
      setYtTitle(currentProject.publishingMetadata?.youtube?.title || currentProject.title || '');
      setTtCaption(currentProject.publishingMetadata?.tiktok?.caption || currentProject.concept || '');
      setIgCaption(currentProject.publishingMetadata?.instagram?.caption || currentProject.concept || '');
      setXText(currentProject.publishingMetadata?.x?.postText || `${currentProject.title}\n\n動画で解説しました👇`);
    }
  }, [currentProject]);

  // 投稿URLの登録ステート（実投稿後のトラッキング用）
  const [publishedUrl, setPublishedUrl] = useState<string>('');
  const [isUrlSaved, setIsUrlSaved] = useState<boolean>(false);

  const videoDownloadUrl = '/videos/short_clip_1.mp4';

  if (!currentProject) {
    return (
      <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Film size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
        <p>配信可能なプロジェクトが登録されていません。</p>
      </div>
    );
  }

  const isAlreadyPublished = Boolean(
    currentProject.publishingMetadata?.youtube?.published &&
    currentProject.publishingMetadata?.tiktok?.published
  );

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top action header */}
      <div className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>マルチSNS配信・実投稿センター</h2>
            {isAlreadyPublished ? (
              <span className="badge badge-success">
                <CheckCircle2 size={13} />
                全SNS配信・記録完了
              </span>
            ) : (
              <span className="badge badge-warning">
                <Clock size={13} />
                承認・配信待機中
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            レンダリングされた実MP4動画と、各SNS最適化テキストを組み合わせて手動またはAPIで投稿します。
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* MP4動画ダウンロードボタン */}
          <a
            href={videoDownloadUrl}
            download="short_clip_1.mp4"
            className="btn-secondary"
            style={{ textDecoration: 'none', color: '#ffffff' }}
          >
            <Download size={16} />
            <span>動画を保存 (7.3MB)</span>
          </a>

          {/* 一括承認・投稿シミュレーションボタン */}
          <button
            onClick={() => onPublishAll(currentProject.id)}
            className="btn-primary"
            disabled={isPublishing || isAlreadyPublished}
            style={{
              background: isAlreadyPublished ? 'rgba(255,255,255,0.1)' : 'var(--grad-ai)',
              cursor: isAlreadyPublished ? 'default' : 'pointer'
            }}
          >
            {isPublishing ? (
              <>
                <Sparkles size={16} className="animate-spin" />
                <span>全SNSへ同時投稿中...</span>
              </>
            ) : isAlreadyPublished ? (
              <>
                <CheckCircle2 size={16} color="var(--accent-emerald)" />
                <span>投稿済み (記録完了)</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>全SNSへ一括承認・配信完了にする</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Metadata Configuration Workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '24px'
      }}>
        {/* Platform Selector Sidebar */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            配信先プラットフォーム
          </div>

          {/* YouTube */}
          <button
            onClick={() => setActivePlatformTab('youtube')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: activePlatformTab === 'youtube' ? 'rgba(255, 0, 51, 0.15)' : 'transparent',
              border: activePlatformTab === 'youtube' ? '1px solid rgba(255, 0, 51, 0.4)' : '1px solid transparent',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-yt)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>YouTube Shorts</span>
            </div>
            {currentProject.publishingMetadata.youtube.published ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>済</span>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: 600 }}>待機</span>
            )}
          </button>

          {/* TikTok */}
          <button
            onClick={() => setActivePlatformTab('tiktok')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: activePlatformTab === 'tiktok' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
              border: activePlatformTab === 'tiktok' ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid transparent',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-tt)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>TikTok</span>
            </div>
            {currentProject.publishingMetadata.tiktok.published ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>済</span>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: 600 }}>待機</span>
            )}
          </button>

          {/* Instagram */}
          <button
            onClick={() => setActivePlatformTab('instagram')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: activePlatformTab === 'instagram' ? 'rgba(225, 48, 108, 0.15)' : 'transparent',
              border: activePlatformTab === 'instagram' ? '1px solid rgba(225, 48, 108, 0.4)' : '1px solid transparent',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-ig-mid)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Instagram (Reels)</span>
            </div>
            {currentProject.publishingMetadata.instagram.published ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>済</span>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: 600 }}>待機</span>
            )}
          </button>

          {/* X */}
          <button
            onClick={() => setActivePlatformTab('x')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: activePlatformTab === 'x' ? 'rgba(29, 155, 240, 0.15)' : 'transparent',
              border: activePlatformTab === 'x' ? '1px solid rgba(29, 155, 240, 0.4)' : '1px solid transparent',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-x)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>X (Twitter)</span>
            </div>
            {currentProject.publishingMetadata.x.published ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>済</span>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-amber)', fontWeight: 600 }}>待機</span>
            )}
          </button>
        </div>

        {/* Platform Editor Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          {activePlatformTab === 'youtube' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ff4d6d' }}>
                    YouTube Shorts 投稿設定
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    アルゴリズムに最適化したタイトルと検索タグ
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href="https://studio.youtube.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <span>YouTube Studioを開く</span>
                    <ExternalLink size={13} />
                  </a>
                  <button
                    onClick={() => copyToClipboard(ytTitle, 'yt-title')}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <Copy size={13} />
                    <span>{copiedKey === 'yt-title' ? 'コピー完了！' : 'タイトルをコピー'}</span>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  動画タイトル
                </label>
                <input
                  type="text"
                  value={ytTitle}
                  onChange={(e) => setYtTitle(e.target.value)}
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

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    推奨ハッシュタグ
                  </label>
                  <button
                    onClick={() => copyToClipboard(currentProject.publishingMetadata.youtube.tags.map(t => `#${t}`).join(' '), 'yt-tags')}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {copiedKey === 'yt-tags' ? 'コピー完了！' : 'タグ一括コピー'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {currentProject.publishingMetadata.youtube.tags.map((tag, i) => (
                    <span key={i} style={{
                      background: 'rgba(255, 0, 51, 0.1)',
                      color: '#ff4d6d',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activePlatformTab === 'tiktok' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-tt)' }}>
                    TikTok キャプション設定
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    初速エンゲージメントを高めるキャプションとトレンドハッシュタグ
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href="https://www.tiktok.com/creator-center/upload"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <span>TikTok投稿画面を開く</span>
                    <ExternalLink size={13} />
                  </a>
                  <button
                    onClick={() => copyToClipboard(ttCaption, 'tt-caption')}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <Copy size={13} />
                    <span>{copiedKey === 'tt-caption' ? 'コピー完了！' : 'キャプションをコピー'}</span>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  動画キャプション
                </label>
                <textarea
                  rows={4}
                  value={ttCaption}
                  onChange={(e) => setTtCaption(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    lineHeight: 1.5
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  推奨バズハッシュタグ
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {currentProject.publishingMetadata.tiktok.hashtags.map((h, i) => (
                    <span key={i} style={{
                      background: 'rgba(0, 242, 254, 0.1)',
                      color: '#38bdf8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}>
                      #{h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activePlatformTab === 'instagram' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f472b6' }}>
                    Instagram Reels 設定
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    保存率を高めるリールキャプション
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => copyToClipboard(igCaption, 'ig-caption')}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <Copy size={13} />
                    <span>{copiedKey === 'ig-caption' ? 'コピー完了！' : 'キャプションをコピー'}</span>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <textarea
                  rows={4}
                  value={igCaption}
                  onChange={(e) => setIgCaption(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    lineHeight: 1.5
                  }}
                />
              </div>
            </div>
          )}

          {activePlatformTab === 'x' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-x)' }}>
                    X (Twitter) ポスト設定
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    動画付きインプレッション獲得用ポスト文
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href="https://twitter.com/compose/tweet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <span>Xを開いて投稿</span>
                    <ExternalLink size={13} />
                  </a>
                  <button
                    onClick={() => copyToClipboard(xText, 'x-text')}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <Copy size={13} />
                    <span>{copiedKey === 'x-text' ? 'コピー完了！' : 'ポスト文をコピー'}</span>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <textarea
                  rows={5}
                  value={xText}
                  onChange={(e) => setXText(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    lineHeight: 1.5
                  }}
                />
              </div>
            </div>
          )}

          {/* 実投稿後のURL登録エリア（アナリティクス連携用） */}
          <div style={{
            marginTop: '24px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '18px'
          }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '6px' }}>
              🔗 投稿完了後の動画URLを記録（アナリティクス追跡用）
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="例: https://youtube.com/shorts/xxxxxx または https://tiktok.com/@.../video/..."
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}
              />
              <button
                onClick={() => {
                  if (publishedUrl) setIsUrlSaved(true);
                }}
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 16px' }}
              >
                {isUrlSaved ? <CheckCircle2 size={14} color="var(--accent-emerald)" /> : <Link2 size={14} />}
                <span>{isUrlSaved ? '登録完了' : 'URLを登録'}</span>
              </button>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              ここにURLを登録しておくと、後から再生数やコメントをCriticAIに検証させることができます。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
