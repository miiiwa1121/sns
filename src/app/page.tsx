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

  // 1. 自律リサーチの手動トリガー
  const handleTriggerNewResearch = () => {
    setIsGenerating(true);
    addLog('TrendScout', 'info', 'YouTube, TikTok, X のリアルタイム急上昇トレンドをスキャン中...');

    setTimeout(() => {
      const currentAcc = accounts.find(a => a.id === currentAccountId);
      const isTech = currentAcc?.slug === 'techstart-jp';

      const newTrend: TrendItem = isTech ? {
        id: `trend-${Date.now()}`,
        topic: '2026年プログラミング初学者が選ぶべき最強言語：PythonかTypeScriptか？',
        category: 'キャリア / スキルアップ',
        platforms: ['youtube', 'x'],
        buzzScore: 91,
        searchVolume: '140K / week',
        trendVelocity: '+76%',
        sentiment: 'positive',
        suggestedAngle: '初学者が半年で案件獲得するまでの最短ロードマップ比較'
      } : {
        id: `trend-${Date.now()}`,
        topic: 'PCを勝手に操作する自律型AIエージェント「Claude Code & Manus」の破壊的進化',
        category: 'AI・IT',
        platforms: ['youtube', 'x', 'tiktok'],
        buzzScore: 97,
        searchVolume: '620K / week',
        trendVelocity: '+240%',
        sentiment: 'positive',
        suggestedAngle: '指示待ちチャットAIの終焉と、仕事を丸投げできる自律エージェントの現場導入術'
      };

      setTrends(prev => [newTrend, ...prev]);
      setIsGenerating(false);
      addLog('TrendScout', 'success', `新トレンド「${newTrend.topic}」(Buzz: ${newTrend.buzzScore}) を検知しました。`);
      showNotification('💡 新しい急上昇トレンドを検出・登録しました！');
    }, 1500);
  };

  // トレンドから動画制作へ進む
  const handleSelectTrendToProduce = (trend: TrendItem) => {
    setIsGenerating(true);
    addLog('ScriptMaster', 'info', `トレンド「${trend.topic}」に基づく長尺マスター台本および切り抜きショートの構成を生成中...`);

    setTimeout(() => {
      const currentAcc = accounts.find(a => a.id === currentAccountId);
      const newProjId = `proj-${Date.now()}`;
      const newProject: VideoProject = {
        id: newProjId,
        title: `【速報】${trend.topic}`,
        concept: trend.suggestedAngle,
        stage: 'production',
        targetAudience: currentAcc?.targetAudience || '20〜40代 ITビジネス層',
        estimatedViews: '120,000+',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        longForm: {
          title: `【速報】${trend.topic}`,
          description: `今回は急上昇トレンド「${trend.topic}」について徹底解説します！\n\n目次:\n0:00 イントロ・フック\n01:30 トレンドの背景\n04:00 具体的な活用法と実演デモ\n07:30 まとめと今後の展望`,
          duration: 600,
          thumbnailUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
          status: 'rendered',
          script: [
            {
              section: 'イントロ / フック',
              narration: `現在SNSで話題沸騰中の「${trend.topic}」ですが、皆さんはもうチェックしましたか？`,
              visualCue: 'ネオンタイポグラフィ、急上昇グラフ演出',
              durationSec: 25
            },
            {
              section: '核心の解説',
              narration: 'この技術がなぜ注目されているのか、その理由は圧倒的な業務効率化と自動化にあります。',
              visualCue: '比較UIとデモ画面のアニメーション',
              durationSec: 60
            }
          ]
        },
        shortClips: [
          {
            id: `clip-${Date.now()}-1`,
            title: `【神まとめ】30秒でわかる${trend.topic.slice(0, 18)}...`,
            startTime: 0,
            endTime: 28,
            duration: 28,
            hookHookSentence: '「まだ手作業でこれやってる人、今すぐやめてください！」',
            targetPlatforms: ['youtube', 'tiktok', 'instagram', 'x'],
            aspectRatio: '9:16',
            captionStyle: 'dynamic-bounce',
            estimatedRetentionRate: 88,
            bgmTrack: 'Cyberpunk Lo-Fi Beat #04',
            readyToPublish: true
          }
        ],
        publishingMetadata: {
          youtube: {
            title: `【速報】${trend.topic} #shorts`,
            tags: ['AIエージェント', '最新トレンド', '自動化'],
            visibility: 'public',
            published: false
          },
          tiktok: {
            caption: `${trend.topic}がヤバすぎる件！ #神ツール #最新情報`,
            hashtags: ['AI活用', 'トレンド', '自動化'],
            privacyLevel: 'public_to_everyone',
            published: false
          },
          instagram: {
            caption: `【必見】${trend.topic}\n詳細はプロフリンクから！`,
            coverFrameSec: 1,
            shareToFeed: true,
            published: false
          },
          x: {
            postText: `【速報】${trend.topic}\n\n動画でサクッと解説しました👇`,
            published: false
          }
        }
      };

      setProjects(prev => [newProject, ...prev]);
      setCurrentProjectId(newProjId);
      setIsGenerating(false);
      setActiveTab('studio');
      addLog('ClipCutter', 'success', `長尺台本と縦型ショート動画の生成が完了しました。（ID: ${newProjId}）`);
      showNotification('🎬 新規プロジェクトの台本とショート動画が生成されました！');
    }, 2000);
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

      if (data.success) {
        setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            return {
              ...p,
              stage: 'published',
              publishingMetadata: {
                youtube: { ...p.publishingMetadata.youtube, published: true },
                tiktok: { ...p.publishingMetadata.tiktok, published: true },
                instagram: { ...p.publishingMetadata.instagram, published: true },
                x: { ...p.publishingMetadata.x, published: true }
              }
            };
          }
          return p;
        }));

        const ytMsg = data.results?.youtube?.message || '全プラットフォームへの送信完了';
        addLog('Dispatcher', 'success', `【全SNS配信完了】${ytMsg}`);
        showNotification(data.message || '🚀 全プラットフォームへの配信処理が完了しました！');
      } else {
        addLog('Dispatcher', 'warning', `配信警告: ${data.error}`);
        showNotification(`⚠️ 配信通知: ${data.error}`);
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
        addLog('CriticAI', 'warning', `知見保存警告: ${data.error || '知見保存に失敗しました'}`);
        showNotification(`⚠️ 知見保存通知: ${data.error}`);
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
        // アカウントデータを再同期
        const accRes = await fetch('/api/accounts');
        const accData = await accRes.json();
        if (accData.success && accData.accounts) {
          setAccounts(accData.accounts);
          const updatedAcc = accData.accounts.find((a: any) => a.id === currentAccountId);
          if (updatedAcc?.projects) setProjects(updatedAcc.projects.map(mapDbProjectToUi));
          if (updatedAcc?.agentKnowledges) setKnowledges(updatedAcc.agentKnowledges);
        }
        addLog('CriticAI', 'success', `【集計完了】動画のアナリティクス指標と改善レポートを生成しました。`);
        showNotification('📊 アナリティクス実績が集計されました！');
      }
    } catch (err: any) {
      console.error('Failed to refresh analytics:', err);
      addLog('CriticAI', 'warning', `集計エラー: ${err.message}`);
    } finally {
      setIsApplyingFeedback(false);
    }
  };

  // 5. 自律モード切り替え & Auto-Pilot 実行
  const handleToggleAutonomous = async () => {
    const next = !autonomousMode;
    setAutonomousMode(next);

    if (next) {
      addLog('TrendScout', 'info', '⚡ 完全自律モード (Auto-Pilot) が起動しました。無人巡回サイクル（リサーチ→台本→投稿→分析）を開始します...');
      showNotification('⚡ 完全自律モード ON: AIが無人自走サイクルを開始します');

      try {
        const res = await fetch('/api/cron/autonomous-cycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountSlug: currentAccount?.slug || 'ai-pulse-lab' }),
        });

        const data = await res.json();
        if (data.success && data.cycleSummary) {
          addLog('ScriptMaster', 'info', `【自動制作】「${data.cycleSummary.projectTitle.slice(0, 30)}...」を生成しました。`);
          addLog('Dispatcher', 'success', '【自動配信】YouTube, TikTok, Instagram, X への無人投稿を完了しました。');
          addLog('CriticAI', 'success', `【自律学習】新ルール「${data.cycleSummary.newKnowledge.slice(0, 30)}...」を蓄積しました。`);
          showNotification('🎉 Auto-Pilot 巡回サイクルが完走しました！新動画が自動投稿・学習されました。');

          // アカウントデータの最新再取得
          const accRes = await fetch('/api/accounts');
          const accData = await accRes.json();
          if (accData.success && accData.accounts) {
            setAccounts(accData.accounts);
            const updated = accData.accounts.find((a: any) => a.id === currentAccountId) || accData.accounts[0];
            if (updated?.projects) setProjects(updated.projects.map(mapDbProjectToUi));
            if (updated?.agentKnowledges) setKnowledges(updated.agentKnowledges);
          }
        }
      } catch (err: any) {
        console.error('Auto-Pilot error:', err);
        addLog('TrendScout', 'warning', `Auto-Pilot 通信エラー: ${err.message}`);
      }
    } else {
      addLog('Dispatcher', 'info', '承認制モード (Human-in-Loop) に切り替わりました。投稿前にレビューを待機します。');
      showNotification('🛡️ 承認制モード: 人間のワンクリック承認を経て投稿されます。');
    }
  };

  const pendingApprovals = projects.filter(
    p => !p.publishingMetadata?.youtube?.published || !p.publishingMetadata?.tiktok?.published
  ).length;

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const currentAccount = accounts.find(a => a.id === currentAccountId) || accounts[0];

  // 100% データベース実データから集計されたリアルKPI
  const realTotalViews = projects.reduce((acc, p) => acc + (p.analytics?.totalViews || 0), 0);
  const projectsWithAnalytics = projects.filter(p => p.analytics);
  const avgRetention = projectsWithAnalytics.length > 0
    ? (projectsWithAnalytics.reduce((acc, p) => acc + (p.analytics?.retentionRate || 0), 0) / projectsWithAnalytics.length).toFixed(1) + '%'
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
