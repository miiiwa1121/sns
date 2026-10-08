import { VideoProject, TrendItem, AgentLog } from './types';

export const INITIAL_TRENDS: TrendItem[] = [
  {
    id: 'trend-1',
    topic: '2026年最新AIエージェント仕事術：人間は何をする？',
    category: 'テクノロジー / 生産性',
    platforms: ['youtube', 'x', 'tiktok'],
    buzzScore: 96,
    searchVolume: '480K / week',
    trendVelocity: '+128%',
    sentiment: 'curious',
    suggestedAngle: '自動化による「自由な時間の使い方」と「消える仕事・残る仕事」の具体例解説'
  },
  {
    id: 'trend-2',
    topic: 'ショート動画アルゴリズム完全攻略：視聴維持率70%の壁',
    category: 'マーケティング / SNS',
    platforms: ['tiktok', 'instagram', 'youtube'],
    buzzScore: 89,
    searchVolume: '310K / week',
    trendVelocity: '+85%',
    sentiment: 'positive',
    suggestedAngle: '最初の1.5秒で離脱させない「フックの型」トップ5選'
  },
  {
    id: 'trend-3',
    topic: '次世代音声AIと超リアルアバターの劇的進化',
    category: 'AIクリエイティブ',
    platforms: ['x', 'youtube'],
    buzzScore: 82,
    searchVolume: '190K / week',
    trendVelocity: '+42%',
    sentiment: 'positive',
    suggestedAngle: '肉声とAI音声の聞き分けブラインドテスト企画'
  }
];

export const INITIAL_PROJECTS: VideoProject[] = [
  {
    id: 'proj-1',
    title: '【完全自律】AIエージェントにYouTube運営を丸投げしてみた結果',
    concept: 'リサーチから動画編集・SNS投稿までAIが自律稼働する最新技術の実録ドキュメンタリーとノウハウ解説',
    stage: 'analyzed',
    targetAudience: '20〜40代 ビジネスパーソン・クリエイター・マーケター',
    estimatedViews: '150,000+',
    createdAt: '2026-10-06 14:00',
    updatedAt: '2026-10-08 05:30',
    longForm: {
      title: '【革命】AIが勝手にバズる動画を作り続ける時代へ…実際の運用データと収益を全公開！',
      description: '今回は最新AI自律エージェントを導入して、SNS運用を完全自動化させた検証結果を詳しく解説します！\n\n目次:\n0:00 衝撃の運用結果\n01:45 自律AIの仕組み\n04:12 長尺からショート動画の切り抜き自動化\n07:30 アナリティクスとPDCAの自動フィードバック\n10:15 今後のロードマップと注意点',
      duration: 720, // 12分
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      status: 'published',
      script: [
        {
          section: 'イントロ / フック',
          narration: '人間が寝ている間に、AIがトレンドを調べて動画を作って投稿まで完了していたら…そんな未来が、今まさに現実になりました。',
          visualCue: '暗転からネオンロゴ表示、スマホの通知が連打される画面',
          durationSec: 25
        },
        {
          section: '検証データ発表',
          narration: '実際に30日間運用した結果、YouTubeとTikTok合算で総再生数は驚異の280万回を突破。しかも手作業は週30分の承認確認のみ。',
          visualCue: 'アナリティクスグラフの急上昇アニメーション',
          durationSec: 45
        },
        {
          section: '切り抜き自動化のキモ',
          narration: '長尺動画の中から「最も感情が動く15秒」をAIが自動で切り出し、9:16のスマホ画面にリフレームして動くテロップを生成します。',
          visualCue: '横型動画から縦型ショートへの自動クロップ比較デモ',
          durationSec: 60
        }
      ]
    },
    shortClips: [
      {
        id: 'clip-1a',
        title: '【神機能】AIが勝手にショート動画に切り抜く瞬間がヤバい',
        startTime: 105,
        endTime: 145,
        duration: 40,
        hookHookSentence: '「まだ手作業でテロップ入れてるの？時代遅れです」',
        targetPlatforms: ['youtube', 'tiktok', 'instagram', 'x'],
        aspectRatio: '9:16',
        captionStyle: 'dynamic-bounce',
        estimatedRetentionRate: 84,
        bgmTrack: 'Cyberpunk Lo-Fi Beat #04',
        readyToPublish: true
      },
      {
        id: 'clip-1b',
        title: 'AIに30日間SNS任せた結果…再生数の伸びがエグい件',
        startTime: 250,
        endTime: 295,
        duration: 45,
        hookHookSentence: '「寝て起きたら再生数100万回超えてた時の画面」',
        targetPlatforms: ['tiktok', 'youtube'],
        aspectRatio: '9:16',
        captionStyle: 'neon-glow',
        estimatedRetentionRate: 79,
        bgmTrack: 'Phonk Upbeat Rush',
        readyToPublish: true
      }
    ],
    publishingMetadata: {
      youtube: {
        title: '【衝撃】AIが勝手に動画作って投稿する時代。寝てる間に280万再生いった裏側 #Shorts',
        tags: ['AIエージェント', '自動化', 'YouTube運用', 'Remotion', '副業'],
        visibility: 'public',
        scheduledAt: '2026-10-07 19:00',
        published: true
      },
      tiktok: {
        caption: 'まだ動画編集で徹夜してる？AIに任せたら1分で切り抜きできた件🔥 #AI活用 #神ツール #動画編集 #自動化',
        hashtags: ['AI活用', '神ツール', '動画編集', '自動化', 'バズる裏技'],
        privacyLevel: 'public_to_everyone',
        published: true
      },
      instagram: {
        caption: '【必見】AI自律エージェントでSNS運用を完全ハック！長尺動画からリールへの自動切り抜きが神すぎる✨\nプロフィールのリンクから解説動画をチェック！',
        coverFrameSec: 2,
        shareToFeed: true,
        published: true
      },
      x: {
        postText: 'YouTubeとTikTokの動画運用、マジでAIだけで完結するようになりました。\n\n1. トレンド自動収集\n2. 台本・音声合成\n3. Remotionで動く字幕付き切り抜き\n4. 各SNSへワンクリック配信\n\n実際に動いている管理ダッシュボードの様子がこちら👇',
        published: true
      }
    },
    analytics: {
      totalViews: 342000,
      retentionRate: 74.2,
      totalLikes: 28400,
      totalShares: 4320,
      totalComments: 1250,
      platformBreakdown: [
        { platform: 'youtube', views: 145000, engagementRate: 8.4, topComment: 'このシステム本当に一般公開してほしい！切り抜きのテンポ最高' },
        { platform: 'tiktok', views: 128000, engagementRate: 11.2, topComment: '最初の1秒で気になって最後まで見ちゃったw' },
        { platform: 'instagram', views: 46000, engagementRate: 6.8, topComment: '文字のバウンスアニメーション見やすいですね' },
        { platform: 'x', views: 23000, engagementRate: 4.9, topComment: '技術スタックが気になります。Remotionですか？' }
      ],
      aiDiagnosis: {
        summary: '冒頭1.2秒の強烈なフック（否定形の疑問文）により、TikTokおよびYouTube Shortsでの初期離脱が前週比-24%改善。',
        strengths: [
          'フック部分のテロップに蛍光イエローのバウンス効果を採用したことで視線誘導に成功',
          'BGMのビートに合わせて画面切り替えが同期しており、視聴維持率が終盤まで高水準（74%維持）',
          'コメント欄での「ツールの詳細希望」質問が多く、次回企画へのリード獲得率が高い'
        ],
        weaknesses: [
          'Instagram Reelsにおいて、キャプション（本文）の最初の2行が省略表示されCTAへの導線がやや弱い',
          '後半8秒のまとめ部分で若干テンポが落ち、微小な離脱が発生している'
        ],
        actionableFeedbackForNext: '次回はInstagram向けにカバー画像をよりコントラスト高めに設定し、まとめパートにカウントダウンタイマーを挿入して最後まで見切らせる構成を推奨します。'
      }
    }
  },
  {
    id: 'proj-2',
    title: '【徹底検証】2026年最新AIモデルで動画台本を作るとどうなるか？',
    concept: '長尺での各AIモデル（Gemini, Claude, GPT）の台本比較と、それぞれの特性を活かした切り抜きバズテクニック',
    stage: 'review',
    targetAudience: 'エンジニア・AI愛好家・プロンプトデザイナー',
    estimatedViews: '95,000+',
    createdAt: '2026-10-07 20:00',
    updatedAt: '2026-10-08 06:10',
    longForm: {
      title: '【2026年版】主要LLMの台本生成力を比較検証！動画作成で一番バズるAIはどれだ？',
      description: '台本制作における各AIモデルの表現力・テンポ感・視聴維持の仕掛けを徹底解剖！',
      duration: 540, // 9分
      thumbnailUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
      status: 'rendered',
      script: [
        {
          section: '導入',
          narration: '「AIで台本を作ると無難でつまらない」そう思っていませんか？実は指示の出し方一つでプロ級のテンポが手に入ります。',
          visualCue: '比較検証グラフの出現',
          durationSec: 20
        },
        {
          section: '3大モデル対決',
          narration: 'Gemini、Claude、GPTそれぞれに同じお題で「最初の15秒」を書かせたところ、全く異なるアプローチが出ました。',
          visualCue: '画面3分割での台本テキストタイピング',
          durationSec: 50
        }
      ]
    },
    shortClips: [
      {
        id: 'clip-2a',
        title: '【台本比較】AIにバズる台本書かせたら差がヤバすぎた',
        startTime: 40,
        endTime: 85,
        duration: 45,
        hookHookSentence: '「これ見ると、もう人間が台本考える意味ないかも…」',
        targetPlatforms: ['youtube', 'tiktok', 'x'],
        aspectRatio: '9:16',
        captionStyle: 'dynamic-bounce',
        estimatedRetentionRate: 88,
        bgmTrack: 'Future Bass Energetic #02',
        readyToPublish: false
      }
    ],
    publishingMetadata: {
      youtube: {
        title: '【比較】主要AIに動画の台本書かせたらクオリティ差がエグすぎた #Shorts',
        tags: ['AI台本', 'プロンプト', 'Gemini', 'Claude', 'YouTube運用'],
        visibility: 'public',
        scheduledAt: '2026-10-08 18:00',
        published: false
      },
      tiktok: {
        caption: 'AIに台本作らせてみたら予想外の展開に…どれが一番自然？コメントで教えて！💡 #AI検証 #バズる方法 #動画制作',
        hashtags: ['AI検証', 'バズる方法', '動画制作', 'ChatGPT', 'Claude'],
        privacyLevel: 'public_to_everyone',
        published: false
      },
      instagram: {
        caption: '各AIモデルの台本作成力を徹底比較！台本が良いと視聴維持率がここまで変わる…！？',
        coverFrameSec: 1,
        shareToFeed: true,
        published: false
      },
      x: {
        postText: '【AI台本検証】\n同じテーマで各LLMに台本を出力させたら、視聴者の心をつかむ「フック」の設計に明らかな違いが出ました。\n\n詳細動画はこちら👇',
        published: false
      }
    }
  }
];

export const INITIAL_LOGS: AgentLog[] = [
  {
    id: 'log-1',
    timestamp: '06:08:12',
    agentName: 'CriticAI',
    level: 'success',
    message: 'プロジェクト「【完全自律】AIエージェントにYouTube運営を丸投げしてみた結果」のアナリティクス分析完了。次回への改善知見をナレッジベースに格納しました。'
  },
  {
    id: 'log-2',
    timestamp: '06:05:40',
    agentName: 'ClipCutter',
    level: 'info',
    message: '新規企画「主要LLMの台本生成力を比較検証」から、視聴維持率予測88%のハイライト（45秒）を1本抽出・字幕レンダリング準備完了。'
  },
  {
    id: 'log-3',
    timestamp: '06:01:15',
    agentName: 'ScriptMaster',
    level: 'info',
    message: '長尺動画台本（9分構成）およびナレーションのタイムライン最適化が完了しました。'
  },
  {
    id: 'log-4',
    timestamp: '05:50:22',
    agentName: 'TrendScout',
    level: 'success',
    message: 'YouTube, TikTok, X のリアルタイム急上昇トレンドから3件の有望トピックを特定・スコアリング完了。'
  }
];
