'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { PipelineOverview, ActiveTab } from '@/components/PipelineOverview';
import { ResearchView } from '@/components/ResearchView';
import { StudioView } from '@/components/StudioView';
import { ApprovalView } from '@/components/ApprovalView';
import { AnalyticsView } from '@/components/AnalyticsView';
import { SettingsModal } from '@/components/SettingsModal';
import { CreateAccountModal } from '@/components/CreateAccountModal';
import { AgentActivityTicker } from '@/components/AgentActivityTicker';
import { VideoProject, TrendItem, AgentLog } from '@/lib/types';
import { mapDbProjectToUi } from '@/lib/projectMapper';
import { Building2, Sparkles, CheckCircle2, BookOpen, Layers, Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [autonomousMode, setAutonomousMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // マルチアカウント管理ステート
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string>('');
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState<boolean>(false);

  // プロジェクト・トレンド・ログ・知見 (100% SQLite DB実データ)
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [knowledges, setKnowledges] = useState<any[]>([]);
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isApplyingFeedback, setIsApplyingFeedback] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const addLog = (agentName: AgentLog['agentName'], level: AgentLog['level'], message: string) => {
    const time = new Date().toTimeString().split(' ')[0];
    const newLog: AgentLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: time,
      agentName,
      level,
      message
    };
    setLogs(prev => [newLog, ...prev.slice(0, 14)]);
  };

  // 初回マウント時にSQLiteデータベースからアカウント・プロジェクト一覧を読み込む
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
          const first = data.accounts[0];
          setCurrentAccountId(first.id);

          // DBプロジェクトの同期
          if (first.projects && first.projects.length > 0) {
            const mapped = first.projects.map(mapDbProjectToUi);
            setProjects(mapped);
            setCurrentProjectId(mapped[0].id);
          } else {
            setProjects([]);
            setCurrentProjectId('');
          }

          // DB知見の同期
          if (first.agentKnowledges && first.agentKnowledges.length > 0) {
            setKnowledges(first.agentKnowledges);
          } else {
            setKnowledges([]);
          }

          // DBトレンドの同期
          if (first.trendResearches && first.trendResearches.length > 0) {
            const mappedTrends = first.trendResearches.map((tr: any) => ({
              id: tr.id,
              topic: tr.topic,
              category: tr.category,
              platforms: ['youtube', 'tiktok', 'instagram', 'x'] as any,
              buzzScore: tr.buzzScore,
              searchVolume: tr.searchVolume,
              trendVelocity: tr.trendVelocity,
              sentiment: 'positive' as const,
              suggestedAngle: tr.suggestedAngle
            }));
            setTrends(mappedTrends);
          } else {
            setTrends([]);
          }

          addLog('TrendScout', 'info', `SQLite DB (dev.db) より「${first.name}」のプロジェクト(${first.projects?.length || 0}件)、知見(${first.agentKnowledges?.length || 0}件)を読み込みました。`);
        }
      })
      .catch(err => {
        console.error('Failed to load accounts from SQLite:', err);
        addLog('TrendScout', 'warning', `データベース接続エラー: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // アカウント切り替え時の処理
  const handleSelectAccount = (id: string) => {
    setCurrentAccountId(id);
    const selected = accounts.find(a => a.id === id);
    if (selected) {
      if (selected.projects && selected.projects.length > 0) {
        const mapped = selected.projects.map(mapDbProjectToUi);
        setProjects(mapped);
        setCurrentProjectId(mapped[0].id);
      } else {
        setProjects([]);
        setCurrentProjectId('');
      }

      if (selected.trendResearches && selected.trendResearches.length > 0) {
        const mappedTrends = selected.trendResearches.map((tr: any) => ({
          id: tr.id,
          topic: tr.topic,
          category: tr.category,
          platforms: ['youtube', 'tiktok', 'instagram', 'x'] as any,
          buzzScore: tr.buzzScore,
          searchVolume: tr.searchVolume,
          trendVelocity: tr.trendVelocity,
          sentiment: 'positive' as const,
          suggestedAngle: tr.suggestedAngle
        }));
        setTrends(mappedTrends);
      } else {
        setTrends([]);
      }

      if (selected.agentKnowledges) {
        setKnowledges(selected.agentKnowledges);
      } else {
        setKnowledges([]);
      }

      addLog('TrendScout', 'info', `運用チャンネルを「${selected.name} (${selected.category})」に切り替えました。`);
      showNotification(`📺 アカウントを「${selected.name}」に切り替えました`);
    }
  };

  // 新規アカウント作成時の処理
  const handleAccountCreated = (newAccount: any) => {
    setAccounts(prev => [...prev, newAccount]);
    setCurrentAccountId(newAccount.id);
    setProjects([]);
    setCurrentProjectId('');
    setTrends([]);
    setKnowledges([]);
    addLog('TrendScout', 'success', `新規チャンネル「${newAccount.name}」をSQLite DBに登録しました。`);
    showNotification(`✨ 新規チャンネル「${newAccount.name}」を作成しました！`);
  };

  // DB から現在のアカウントを取り直して画面に反映する
  const reloadCurrentAccount = async () => {
    const accRes = await fetch('/api/accounts');
    const accData = await accRes.json();
    if (accData.success && accData.accounts) {
      setAccounts(accData.accounts);
      const updated = accData.accounts.find((a: any) => a.id === currentAccountId);
      if (updated?.projects) setProjects(updated.projects.map(mapDbProjectToUi));
      if (updated?.agentKnowledges) setKnowledges(updated.agentKnowledges);
    }
  };

  // 1. 自律リサーチの手動トリガー
  // 以前は固定の架空トレンド（架空の検索ボリューム・Buzzスコア）を画面に追加していたため撤去した。
  const handleTriggerNewResearch = () => {
    addLog('TrendScout', 'warning', 'トレンドの自動検知は未実装です。リサーチ結果は TrendResearch テーブルに登録してください。');
    showNotification('⚠️ トレンドの自動検知は未実装です');
  };

  // トレンドから下書きプロジェクトを DB に作成し、制作画面へ進む
  const handleSelectTrendToProduce = async (trend: TrendItem) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trendId: trend.id }),
      });
      const data = await res.json();
      if (!data.success) {
        addLog('ScriptMaster', 'warning', `プロジェクト作成に失敗しました: ${data.error}`);
        showNotification(`⚠️ ${data.error}`);
        return;
      }

      const created = mapDbProjectToUi(data.project);
      setProjects(prev => [created, ...prev]);
      setCurrentProjectId(created.id);
      setActiveTab('studio');
      addLog('ScriptMaster', 'success', `下書きプロジェクト「${created.title}」を作成しました。（ID: ${created.id}）台本は未作成です。`);
      showNotification('📝 下書きプロジェクトを作成しました');
    } catch (err: any) {
      console.error('Failed to create project:', err);
      addLog('ScriptMaster', 'warning', `プロジェクト作成の通信エラー: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. 全SNS一括配信の実行
  const handlePublishAll = async (projectId: string) => {
    setIsPublishing(true);
    addLog('Dispatcher', 'info', '全SNS（YouTube, TikTok, Instagram, X）への一括並列配信パイプラインを起動しました...');

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();

      // 成否はプラットフォームごとに DB に記録されているので、表示は DB から取り直す
      await reloadCurrentAccount();

      if (data.success) {
        addLog('Dispatcher', 'success', `配信成功: ${data.succeeded.join(', ')}`);
        for (const f of data.failed as { platform: string; message: string }[]) {
          addLog('Dispatcher', 'warning', `配信失敗 (${f.platform}): ${f.message}`);
        }
        showNotification(data.allPublished
          ? '🚀 全プラットフォームへの配信が完了しました'
          : `⚠️ 一部のみ配信しました（成功: ${data.succeeded.join(', ')}）`);
      } else {
        addLog('Dispatcher', 'warning', `配信失敗: ${data.error}`);
        showNotification(`⚠️ 配信できませんでした: ${data.error}`);
      }
    } catch (err: any) {
      console.error('Publish failed:', err);
      addLog('Dispatcher', 'warning', `配信通信エラー: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // 4. 分析フィードバックを次回プロンプトへ反映
  const handleApplyFeedback = async () => {
    setIsApplyingFeedback(true);
    addLog('CriticAI', 'info', '動画パフォーマンスを多角分析し、自律学習ルールを抽出中...');

    try {
      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId,
          accountId: currentAccountId,
          applyToKnowledge: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.persistedKnowledge) {
        setKnowledges(prev => [data.persistedKnowledge, ...prev]);
        setAccounts(prev => prev.map(a => {
          if (a.id === currentAccountId) {
            return {
              ...a,
              agentKnowledges: [data.persistedKnowledge, ...(a.agentKnowledges || [])],
            };
          }
          return a;
        }));
        const previewText = data.persistedKnowledge.ruleText.length > 30
          ? `${data.persistedKnowledge.ruleText.slice(0, 30)}...`
          : data.persistedKnowledge.ruleText;
        addLog('CriticAI', 'success', `【自律学習完了】「${previewText}」をナレッジベースに恒久反映しました。`);
        showNotification('🧠 AIエージェントのナレッジベースが更新され、次回の動画制作精度が向上しました！');
      } else {
        const reason = data.error || data.message || '知見保存に失敗しました';
        addLog('CriticAI', 'warning', `知見は保存されませんでした: ${reason}`);
        showNotification(`⚠️ ${reason}`);
      }
    } catch (err: any) {
      console.error('Failed to apply analytics feedback:', err);
      addLog('CriticAI', 'warning', `フィードバック通信エラー: ${err.message}`);
    } finally {
      setIsApplyingFeedback(false);
    }
  };

  // 4b. 指定プロジェクトのアナリティクス集計・再分析
  const handleRefreshAnalytics = async (projectId: string) => {
    setIsApplyingFeedback(true);
    addLog('CriticAI', 'info', `プロジェクト(ID: ${projectId})のアナリティクス指標を集計中...`);

    try {
      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          accountId: currentAccountId,
          applyToKnowledge: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await reloadCurrentAccount();
        addLog('CriticAI', 'success', data.message);
        showNotification('📊 実測アナリティクスを分析しました');
      } else {
        addLog('CriticAI', 'warning', `分析できませんでした: ${data.error}`);
        showNotification(`⚠️ ${data.error}`);
      }
    } catch (err: any) {
      console.error('Failed to refresh analytics:', err);
      addLog('CriticAI', 'warning', `集計エラー: ${err.message}`);
    } finally {
      setIsApplyingFeedback(false);
    }
  };

  // 5. 自律モード切り替え
  // Auto-Pilot（/api/cron/autonomous-cycle）は未実装で、INTERNAL_API_TOKEN が必要なためブラウザからは呼ばない
  const handleToggleAutonomous = () => {
    if (!autonomousMode) {
      addLog('TrendScout', 'warning', '完全自律モード (Auto-Pilot) は未実装です。承認制モードのまま運用します。');
      showNotification('⚠️ 完全自律モードは未実装です');
      return;
    }
    setAutonomousMode(false);
    addLog('Dispatcher', 'info', '承認制モード (Human-in-Loop) に切り替わりました。投稿前にレビューを待機します。');
    showNotification('🛡️ 承認制モード: 人間のワンクリック承認を経て投稿されます。');
  };

  const pendingApprovals = projects.filter(
    p => !p.publishingMetadata?.youtube?.published || !p.publishingMetadata?.tiktok?.published
  ).length;

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const currentAccount = accounts.find(a => a.id === currentAccountId) || accounts[0];

  // 100% データベース実データから集計されたリアルKPI
  const realTotalViews = projects.reduce((acc, p) => acc + (p.analytics?.totalViews || 0), 0);
  const retentions = projects
    .map(p => p.analytics?.retentionRate)
    .filter((r): r is number => typeof r === 'number');
  const avgRetention = retentions.length > 0
    ? (retentions.reduce((acc, r) => acc + r, 0) / retentions.length).toFixed(1) + '%'
    : '-';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--accent-indigo)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8), var(--shadow-glow)',
          fontSize: '0.88rem',
          fontWeight: 600,
          color: '#ffffff',
          animation: 'fadeIn 0.3s ease'
        }}>
          {notification}
        </div>
      )}

      {/* Main App Header with Multi-Account Selector */}
      <Header
        accounts={accounts}
        currentAccountId={currentAccountId}
        onSelectAccount={handleSelectAccount}
        onOpenCreateAccount={() => setIsCreateAccountOpen(true)}
        autonomousMode={autonomousMode}
        onToggleAutonomous={handleToggleAutonomous}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTriggerNewResearch={handleTriggerNewResearch}
        isGenerating={isGenerating}
      />

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '20px 28px' }}>
        {/* Empty accounts onboarding banner */}
        {!currentAccount && !isLoading && (
          <div className="glass-panel" style={{
            padding: '48px 32px',
            textAlign: 'center',
            marginBottom: '28px',
            background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.15) 0%, rgba(17, 24, 39, 0.7) 100%)',
            border: '1px solid var(--accent-indigo)'
          }}>
            <Building2 size={48} color="var(--accent-indigo)" style={{ margin: '0 auto 16px auto' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '10px' }}>
              運用する実在のSNSチャンネルを登録してください
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
              デモ用データは完全に初期化されました。あなたが実際に運用するYouTubeチャンネルやX、TikTok、Instagramのアカウント情報を登録すると、0件・0再生のまっさらな状態から動画制作・投稿・自律学習を開始できます。
            </p>
            <button
              onClick={() => setIsCreateAccountOpen(true)}
              className="btn-primary"
              style={{ fontSize: '0.95rem', padding: '12px 28px', margin: '0 auto' }}
            >
              <Sparkles size={18} />
              <span>実在チャンネル / アカウントを登録する</span>
            </button>
          </div>
        )}

        {/* Active Account Profile Banner (Multi-account context) */}
        {currentAccount && (
          <div className="glass-panel" style={{
            padding: '14px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(17, 24, 39, 0.6) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid var(--accent-indigo)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#c7d2fe'
              }}>
                {currentAccount.category}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{currentAccount.name}</h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {currentAccount.slug}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  コンセプト: <strong style={{ color: '#ffffff' }}>{currentAccount.concept}</strong> | ペルソナ: {currentAccount.targetAudience}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>トーン＆マナー: </span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{currentAccount.toneOfVoice}</strong>
              </div>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                ● SQLite 実DB接続中 ({projects.length} 件のプロジェクト)
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Stepper & Real KPI Summary (100% DB実測値) */}
        <PipelineOverview
          activeTab={activeTab}
          onTabChange={setActiveTab}
          stats={{
            activeProjects: projects.length,
            totalViews: realTotalViews > 0 ? `${realTotalViews.toLocaleString()} 回` : '0 回',
            avgEngagement: avgRetention,
            pendingApprovals
          }}
        />

        {/* Loading state indicator */}
        {isLoading ? (
          <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={36} className="spinning" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '0.9rem' }}>SQLite データベース (dev.db) から実データを読み込み中...</p>
          </div>
        ) : (
          <>
            {/* Tab Content Views */}
            {activeTab === 'research' && (
              <ResearchView
                trends={trends}
                onSelectTrendToProduce={handleSelectTrendToProduce}
                isGenerating={isGenerating}
              />
            )}

            {activeTab === 'studio' && (
              <StudioView
                projects={projects}
                currentProjectId={currentProjectId}
                onSelectProject={setCurrentProjectId}
                onProceedToApproval={(id) => {
                  setCurrentProjectId(id);
                  setActiveTab('approval');
                }}
              />
            )}

            {activeTab === 'approval' && (
              <ApprovalView
                projects={projects}
                currentProjectId={currentProjectId}
                onSelectProject={setCurrentProjectId}
                onPublishAll={handlePublishAll}
                isPublishing={isPublishing}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView
                project={currentProject}
                knowledges={knowledges}
                onApplyFeedbackToNext={handleApplyFeedback}
                isApplying={isApplyingFeedback}
                onRefreshAnalytics={handleRefreshAnalytics}
              />
            )}
          </>
        )}

        {/* Live Agent Activity Feed Ticker */}
        <AgentActivityTicker logs={logs} />
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <CreateAccountModal
        isOpen={isCreateAccountOpen}
        onClose={() => setIsCreateAccountOpen(false)}
        onAccountCreated={handleAccountCreated}
      />
    </div>
  );
}
