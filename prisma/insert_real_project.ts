import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inserting real AI・IT project into SQLite database...');

  // 1. AI速報スタジオ（ai-pulse-lab）を取得
  const account = await prisma.account.findUnique({
    where: { slug: 'ai-pulse-lab' },
  });

  if (!account) {
    throw new Error('Account ai-pulse-lab not found');
  }

  // 2. 新規リアルプロジェクトを作成
  const project = await prisma.project.create({
    data: {
      accountId: account.id,
      title: '【革命】勝手にPCを操作して仕事を終わらせる「AIエージェント」3選！チャットAIの時代は終了しました',
      concept: '「質問して回答を待つ」チャットAIの時代は終了。ManusやClaude Codeなど、ゴールを投げるだけでブラウザ操作からリサーチ・コーディング・資料作成まで完結する最新自律AIの衝撃と使いこなし方を速報解説。',
      stage: 'production',
      targetAudience: '20〜40代 ITエンジニア、ビジネスパーソン、マーケター、DX担当者',
      estimatedViews: '200,000+',
      longFormVideo: {
        create: {
          title: '【革命】勝手にPCを操作して仕事を終わらせる「自律型AIエージェント」3選！チャットAIの時代は終了しました',
          description: `今回は2026年最大のトレンド「自律型AIエージェント」について徹底解説します！\n\nもはや人間が1つずつプロンプトを打って返答を待つ時代ではありません。ゴールを1行伝えるだけで、AIが勝手にブラウザを動かし、コードを書き、業務を終わらせてくれる新世代ツールの衝撃を体感してください。\n\n目次:\n0:00 衝撃のパラダイムシフト（チャットAIの終焉）\n01:45 自律型リサーチエージェントの実力\n04:30 開発・ファイル操作の完全自動化\n07:20 AIエージェント時代に生き残るための3つの鉄則\n09:40 まとめ＆無料テンプレート配布`,
          durationSec: 600, // 10分
          thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
          status: 'rendered',
          scriptJson: JSON.stringify([
            {
              section: 'イントロ / フック (冒頭の衝撃)',
              narration: 'まだChatGPTに1つずつプロンプト打って、返答をコピペしてますか？はっきり言いますが、その使い方はもう完全な時代遅れです。',
              visualCue: '暗転から「自律実行の時代へ」ネオンタイポグラフィ、スマホの通知が連打される画面',
              durationSec: 25
            },
            {
              section: '自律型リサーチエージェントの実力',
              narration: '「競合5社の料金表をまとめてスプレッドシートにして」と1行指示するだけで、AIが勝手にブラウザを開き、クリックしてスクショを撮り、表に整理して納品してくれます。',
              visualCue: '自律エージェントがブラウザを自動操作する画面キャプチャ比較デモ',
              durationSec: 50
            },
            {
              section: '開発・業務の完全自動化',
              narration: '日常業務やコード修正も同じです。エラーが出たらAIが自分で原因をWeb検索し、ファイルを修正してテストまで自走します。人間は最後の承認ボタンを押すだけです。',
              visualCue: 'ターミナルで自律実行されるコードと自動デバッグのアニメーション',
              durationSec: 60
            },
            {
              section: '生き残るための3つの鉄則',
              narration: 'AIエージェント時代に淘汰されない人の共通点は、「プロンプトの工夫」ではなく「ゴールを明確に言語化する力」を持っています。',
              visualCue: 'チェックリスト3箇条のスライドイン演出',
              durationSec: 45
            }
          ])
        }
      },
      shortClips: {
        create: [
          {
            title: '【警告】まだチャットAIに質問してる人、今すぐこれ見て',
            startTimeSec: 10,
            endTimeSec: 52,
            durationSec: 42,
            hookSentence: '「まだチャットAIに質問して返答待ってるの？それ時代遅れです」',
            captionStyle: 'dynamic-bounce',
            aspectRatio: '9:16',
            estimatedRetentionRate: 88,
            bgmTrack: 'Cyberpunk Lo-Fi Beat #04',
            readyToPublish: true
          },
          {
            title: '【神ツール】PCを勝手に操作して仕事終わらせるAIがヤバすぎる件',
            startTimeSec: 105,
            endTimeSec: 143,
            durationSec: 38,
            hookSentence: '「寝て起きたら、AIが勝手に競合リサーチ終わらせてた時の画面」',
            captionStyle: 'neon-glow',
            aspectRatio: '9:16',
            estimatedRetentionRate: 85,
            bgmTrack: 'Phonk Upbeat Rush',
            readyToPublish: true
          }
        ]
      },
      publishLogs: {
        create: [
          {
            platform: 'youtube',
            title: '【革命】勝手にPCを操作して仕事を終わらせる「最新AIエージェント」3選！チャットAIの時代は終了しました #Shorts',
            caption: '今回は2026年最大のトレンド「自律型AIエージェント」について徹底解説します！',
            tagsJson: JSON.stringify(['AIエージェント', '業務効率化', 'Manus', 'ClaudeCode', 'ChatGPT', '自動化']),
            status: 'draft'
          },
          {
            platform: 'tiktok',
            title: 'PCを勝手に操作するAIがヤバすぎる件',
            caption: 'もうAIに質問する時代は終わった…？1行指示するだけで勝手に仕事終わらせてくれる神AIがヤバすぎる件🔥 #AI活用 #神ツール #仕事効率化 #自動化 #ChatGPT',
            tagsJson: JSON.stringify(['AI活用', '神ツール', '仕事効率化', '自動化', '最新トレンド']),
            status: 'draft'
          },
          {
            platform: 'instagram',
            title: '自律型AIエージェント3選',
            caption: '【保存版】2026年最新！業務効率を10倍にする「自律型AIエージェント」3選✨\n指示待ちチャットから、勝手に動いてくれるAIへ。今のうちに知っておかないと乗り遅れます…！\n詳細はプロフィールのリンクから本編動画をチェック📌',
            status: 'draft'
          },
          {
            platform: 'x',
            caption: '「AIに質問して回答をコピペする時代」は完全に終わりました。\n\n2026年の覇権は、ゴールを1行投げるだけで勝手にブラウザを操作して仕事を完結させる「自律型AIエージェント」。\n\n実務で即戦力になる最新3選を動画でまとめました👇',
            status: 'draft'
          }
        ]
      }
    }
  });

  // 3. トレンドリサーチ履歴にも記録
  await prisma.trendResearch.create({
    data: {
      accountId: account.id,
      topic: '指示待ちチャットの終焉：自律型AIエージェントによる業務完全自動化',
      category: 'AI・IT',
      buzzScore: 98,
      searchVolume: '620K / week',
      trendVelocity: '+158%',
      suggestedAngle: 'ゴールを1行伝えるだけでブラウザ操作からリサーチ・コーディングまで完結する新ワークフロー実演'
    }
  });

  console.log(`Successfully created real project "${project.title}" (ID: ${project.id}) for account "${account.name}"!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
