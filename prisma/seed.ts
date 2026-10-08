import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial multi-account data...');

  // クリーンアップ
  await prisma.analyticsMetric.deleteMany();
  await prisma.publishLog.deleteMany();
  await prisma.shortClip.deleteMany();
  await prisma.longFormVideo.deleteMany();
  await prisma.project.deleteMany();
  await prisma.trendResearch.deleteMany();
  await prisma.agentKnowledge.deleteMany();
  await prisma.platformConnection.deleteMany();
  await prisma.account.deleteMany();

  // 1. アカウント1: AI速報スタジオ（AI Pulse Lab）
  const account1 = await prisma.account.create({
    data: {
      name: 'AI速報スタジオ',
      slug: 'ai-pulse-lab',
      category: 'AI・IT',
      concept: '最新AIツール（Gemini, Claude, Cursor, 動画生成AI等）の現場活用法を速報解説',
      targetAudience: '20〜40代 ITエンジニア、ビジネスパーソン、マーケター',
      toneOfVoice: '先見性がありスピーディ、結論先出し、無駄のない知的な語り口',
      systemPromptRules: '冒頭2秒で「何の作業が何分短縮されるか」を断言する。専門用語には即座に具体例を添える。',
      platformConnections: {
        create: [
          { platform: 'youtube', handle: '@ai_pulse_lab', isConnected: true },
          { platform: 'x', handle: '@ai_pulse_lab', isConnected: true },
          { platform: 'tiktok', handle: '@aipulselab', isConnected: true },
          { platform: 'instagram', handle: '@ai_pulse_official', isConnected: true }
        ]
      },
      agentKnowledges: {
        create: [
          {
            category: 'hook',
            ruleText: '冒頭のフックに「まだ手動でこれやってる人、今すぐやめてください」を使うとTikTokの維持率+18%向上',
            confidenceScore: 0.92,
            appliedCount: 4
          },
          {
            category: 'tempo',
            ruleText: '長尺動画では開始2分30秒以内に実際のツールの操作画面デモを挟むと中間離脱が半減する',
            confidenceScore: 0.88,
            appliedCount: 3
          }
        ]
      },
      trendResearches: {
        create: [
          {
            topic: '2026年最新AIエージェント仕事術：人間は何をする？',
            category: 'AI・IT',
            buzzScore: 96,
            searchVolume: '480K / week',
            trendVelocity: '+128%',
            suggestedAngle: '自動化による「自由な時間の使い方」と「消える仕事・残る仕事」の具体例解説'
          },
          {
            topic: '次世代音声AIと超リアルアバターの劇的進化',
            category: 'AI・IT',
            buzzScore: 82,
            searchVolume: '190K / week',
            trendVelocity: '+42%',
            suggestedAngle: '肉声とAI音声の聞き分けブラインドテスト企画'
          }
        ]
      },
      projects: {
        create: [
          {
            title: '【完全自律】AIエージェントにYouTube運営を丸投げしてみた結果',
            concept: 'リサーチから動画編集・SNS投稿までAIが自律稼働する最新技術の実録ドキュメンタリーとノウハウ解説',
            stage: 'analyzed',
            targetAudience: 'ビジネスパーソン・クリエイター',
            estimatedViews: '150,000+',
            longFormVideo: {
              create: {
                title: '【革命】AIが勝手にバズる動画を作り続ける時代へ…実際の運用データと収益を全公開！',
                description: '最新AI自律エージェントを導入して、SNS運用を完全自動化させた検証結果を詳しく解説します！',
                durationSec: 720,
                status: 'published',
                scriptJson: JSON.stringify([
                  { section: 'イントロ / フック', narration: '人間が寝ている間に、AIがトレンドを調べて動画を作って投稿まで完了していたら…', visualCue: '暗転からネオンロゴ表示', durationSec: 25 },
                  { section: '検証データ発表', narration: '実際に運用した結果、YouTubeとTikTok合算で総再生数は280万回を突破。', visualCue: 'グラフ急上昇アニメーション', durationSec: 45 },
                  { section: '切り抜き自動化のキモ', narration: '長尺動画の中から「最も感情が動く15秒」をAIが自動で切り出します。', visualCue: '縦型ショートへのクロップ比較', durationSec: 60 }
                ])
              }
            },
            shortClips: {
              create: [
                {
                  title: '【神機能】AIが勝手にショート動画に切り抜く瞬間がヤバい',
                  startTimeSec: 105,
                  endTimeSec: 145,
                  durationSec: 40,
                  hookSentence: '「まだ手作業でテロップ入れてるの？時代遅れです」',
                  captionStyle: 'dynamic-bounce',
                  aspectRatio: '9:16',
                  estimatedRetentionRate: 84,
                  bgmTrack: 'Cyberpunk Lo-Fi Beat #04',
                  readyToPublish: true
                }
              ]
            },
            analytics: {
              create: [
                { platform: 'youtube', views: 145000, retentionRate: 74.2, likes: 12000, shares: 1800, comments: 620, engagementRate: 8.4, topComment: 'このシステム本当に一般公開してほしい！' },
                { platform: 'tiktok', views: 128000, retentionRate: 78.5, likes: 11400, shares: 2100, comments: 480, engagementRate: 11.2, topComment: '最初の1秒で気になって最後まで見ちゃったw' }
              ]
            }
          }
        ]
      }
    }
  });

  // 2. アカウント2: ゼロから始めるITキャリア（TechStart JP）
  const account2 = await prisma.account.create({
    data: {
      name: 'ゼロから始めるITキャリア',
      slug: 'techstart-jp',
      category: 'AI・IT / キャリア',
      concept: '未経験・非エンジニア向けに、AIやプログラミングで収入を上げる最短ロードマップを解説',
      targetAudience: '20代 未経験転職希望者、文系学生、リスキリングを目指す社会人',
      toneOfVoice: '親しみやすく丁寧、失敗しない安心感、具体的で実践しやすい語り口',
      systemPromptRules: '専門用語を一切使わず身近な例え（料理や日常会話）に置き換える。最後は「今日すぐできる1つの行動」で締める。',
      platformConnections: {
        create: [
          { platform: 'youtube', handle: '@techstart_jp', isConnected: true },
          { platform: 'instagram', handle: '@techstart_jp', isConnected: true },
          { platform: 'tiktok', handle: '@techstart_jp', isConnected: true },
          { platform: 'x', handle: '@techstart_jp', isConnected: false }
        ]
      },
      agentKnowledges: {
        create: [
          {
            category: 'hook',
            ruleText: '「文系・未経験でも3ヶ月で」という安心キーワードを冒頭に置くと保存率が2.5倍になる',
            confidenceScore: 0.95,
            appliedCount: 5
          },
          {
            category: 'cta',
            ruleText: '「保存して後で見返してね」をテロップ下部に常時小さく固定表示するとInstagramの保存率が向上',
            confidenceScore: 0.89,
            appliedCount: 3
          }
        ]
      },
      trendResearches: {
        create: [
          {
            topic: '文系未経験から始める「AI時代のIT転職」完全ロードマップ',
            category: 'AI・IT / キャリア',
            buzzScore: 91,
            searchVolume: '340K / week',
            trendVelocity: '+95%',
            suggestedAngle: 'プログラミング言語を丸暗記する前に知っておくべき「AIにコードを書かせる技術」'
          }
        ]
      },
      projects: {
        create: [
          {
            title: '【未経験必見】2026年に最初に触るべき神AIツールTOP3',
            concept: '挫折しない学習順序と、初心者がつまずきやすいポイントの徹底解説',
            stage: 'production',
            targetAudience: 'IT完全初心者',
            estimatedViews: '80,000+',
            longFormVideo: {
              create: {
                title: '【完全保存版】未経験が今からITで稼ぐならどのAIから始めるべき？',
                description: '初心者が無駄な遠回りをしないための最新ITツール学習法を優しく教えます。',
                durationSec: 540,
                status: 'rendered',
                scriptJson: JSON.stringify([
                  { section: 'はじめに', narration: 'ITの勉強って、難しそうに聞こえますよね。でも実は今、AIのおかげで一番ハードルが下がっています。', visualCue: '温かみのある手描き風イラスト', durationSec: 30 },
                  { section: 'ツール1: 文章作成AI', narration: 'まず最初はメールや資料を自動で作ってくれるAIから体験してみましょう。', visualCue: '実際の画面キャプチャ比較', durationSec: 45 }
                ])
              }
            },
            shortClips: {
              create: [
                {
                  title: '【初心者向け】これ知らないと損するAIの超基本',
                  startTimeSec: 15,
                  endTimeSec: 55,
                  durationSec: 40,
                  hookSentence: '「IT初心者、絶対にこの設定だけはオフにして！」',
                  captionStyle: 'minimal-clean',
                  aspectRatio: '9:16',
                  estimatedRetentionRate: 88,
                  bgmTrack: 'Chill Acoustic Cafe #01',
                  readyToPublish: true
                }
              ]
            }
          }
        ]
      }
    }
  });

  console.log(`Seeded accounts successfully:`);
  console.log(`- ${account1.name} (id: ${account1.id}, slug: ${account1.slug})`);
  console.log(`- ${account2.name} (id: ${account2.id}, slug: ${account2.slug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
