import { VideoProject, TrendItem, HighlightClip, AgentLog } from './types';

export class AgentService {
  /**
   * トレンドリサーチから新規動画企画・長尺台本・切り抜きショートを生成する
   */
  static generateProjectFromTrend(trend: TrendItem): VideoProject {
    const newId = `proj-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newProject: VideoProject = {
      id: newId,
      title: `【最新】${trend.topic}`,
      concept: `${trend.suggestedAngle} をテーマに、最新のデータと実演を交えて解説する完全自律制作コンテンツ`,
      stage: 'production',
      targetAudience: '20〜40代 SNSマーケター・クリエイター・ビジネス層',
      estimatedViews: '120,000+',
      createdAt: now,
      updatedAt: now,
      longForm: {
        title: `【徹底解説】${trend.topic}！知らないと損する実践ノウハウ`,
        description: `今回の動画では、今話題の「${trend.topic}」について徹底解説します！\n\n目次:\n0:00 イントロ・問題提起\n02:10 最新トレンドの背景\n05:30 実践ステップと自動化\n08:45 まとめと次回予告`,
        duration: 600, // 10分
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        status: 'rendered',
        script: [
          {
            section: 'フック / 導入',
            narration: `今話題の「${trend.topic}」。実はこれ、ただの流行ではなく今後の必須スキルです。`,
            visualCue: 'タイトルタイポグラフィと急上昇グラフ',
            durationSec: 20
          },
          {
            section: '核心ノウハウ',
            narration: `${trend.suggestedAngle}。これを実践するだけで成果が何倍にも変わります。`,
            visualCue: '比較検証デモ画面とハイライト枠',
            durationSec: 45
          },
          {
            section: 'アクションプラン',
            narration: 'まずは今日からできる1つのアクションから始めてみてください。',
            visualCue: 'チェックリスト3箇条のスライドイン',
            durationSec: 35
          }
        ]
      },
      shortClips: [
        {
          id: `clip-${Date.now()}-1`,
          title: `【30秒でわかる】${trend.topic.slice(0, 20)}…`,
          startTime: 20,
          endTime: 65,
          duration: 45,
          hookHookSentence: `「まだこれ知らないの？${trend.topic.slice(0, 15)}がヤバい」`,
          targetPlatforms: trend.platforms,
          aspectRatio: '9:16',
          captionStyle: 'dynamic-bounce',
          estimatedRetentionRate: 86,
          bgmTrack: 'Cyberpunk Lo-Fi Beat #08',
          readyToPublish: true
        }
      ],
      publishingMetadata: {
        youtube: {
          title: `【最新検証】${trend.topic} #Shorts`,
          tags: ['AI自動化', '最新トレンド', '効率化', 'YouTube運用'],
          visibility: 'public',
          published: false
        },
        tiktok: {
          caption: `今話題のこれ知ってる？🔥 ${trend.suggestedAngle.slice(0, 30)} #バズる裏技 #最新トレンド #AI活用`,
          hashtags: ['最新トレンド', '神ツール', '動画制作', '自動化'],
          privacyLevel: 'public_to_everyone',
          published: false
        },
        instagram: {
          caption: `【必見】${trend.topic} の実践ポイントをまとめました！保存して見返してね📌`,
          coverFrameSec: 2,
          shareToFeed: true,
          published: false
        },
        x: {
          postText: `【話題の最新トレンドまとめ】\n${trend.topic}\n\n動画でサクッと解説しました👇`,
          published: false
        }
      }
    };

    return newProject;
  }
}
