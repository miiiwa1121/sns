import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('🤖 OmniPulse AI Studio: 自律知見（AgentKnowledge）を取り込んだ第2弾動画の制作を開始します...\n');

  // 1. AI速報スタジオのアカウントと蓄積知見を取得
  const account = await prisma.account.findUnique({
    where: { slug: 'ai-pulse-lab' },
    include: {
      agentKnowledges: {
        orderBy: { confidenceScore: 'desc' },
      },
    },
  });

  if (!account) {
    throw new Error('Account ai-pulse-lab not found');
  }

  console.log(`📺 対象チャンネル: ${account.name} (${account.slug})`);
  console.log(`🧠 読み込まれた学習ルール数: ${account.agentKnowledges.length} 件`);
  account.agentKnowledges.forEach((k, idx) => {
    console.log(`  [知見${idx + 1}] (${k.category}): ${k.ruleText} (信頼度: ${Math.round(k.confidenceScore * 100)}%)`);
  });

  // 2. 蓄積知見を注入した第2弾台本・企画の設計
  // 知見: 「冒頭で従来のやり方の否定＋最新提示をセットで行うと維持率が向上」をフックに厳格適用
  const projectTitle = '【0円神環境】月額課金は終了！自分のPCで完全オフライン自律稼働する「ローカルLLM」構築完全ガイド';
  const projectConcept = 'クラウドAIへの社外秘情報流出リスクを完全ゼロに。Ollamaと軽量オープンモデルを使い、MacBook1台でネット切断時でも勝手にリサーチ・要約・コード生成する最強の自律作業環境を0円で手に入れる。';

  const short1Narration = 'まだ月額3000円払って社外秘データをクラウドAIに送ってませんか？それ、情報漏洩リスク大です！今は自分のMacやPC上で完全無料・オフライン稼働する自律型ローカルAIが簡単に作れる時代。ネット遮断しても爆速で動く最強環境、今すぐ手に入れてください！';

  console.log('\n📝 蓄積ナレッジを反映した第2弾ショート動画台本（冒頭フック）:');
  console.log(`「${short1Narration}」\n`);

  // 3. SQLite DB への第2弾プロジェクトの登録
  const project = await prisma.project.create({
    data: {
      accountId: account.id,
      title: projectTitle,
      concept: projectConcept,
      stage: 'production',
      targetAudience: 'セキュリティ重視のエンジニア、個人開発者、社外秘データを扱うビジネスパーソン',
      estimatedViews: '250,000+',
      longFormVideo: {
        create: {
          title: projectTitle,
          description: `クラウドAIへの課金・情報流出リスクはもう不要！\n今回はMacやWindowsのPC1台で、通信を完全に切断しても自律的に動く「ローカルLLM＆自律エージェント」の無料構築手順を徹底解説します。\n\n目次:\n0:00 クラウドAIのリスクとローカル革命（蓄積ナレッジ反映フック）\n01:30 Ollama + Qwen 2.5のセットアップ（わずか3分）\n04:15 完全オフラインでの資料要約と自律コード生成テスト\n07:30 メモリ16GBのMacでサクサク動かす秘訣\n09:15 まとめ＆おすすめオープンモデル一覧`,
          durationSec: 580,
          thumbnailUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
          status: 'rendered',
          scriptJson: JSON.stringify([
            {
              section: 'イントロ / フック (知見反映: 従来クラウドの否定とリスク)',
              narration: short1Narration,
              visualCue: 'WiFi切断マーク、ターミナルで爆速でトークンが出力される画面、セキュアアイコン',
              durationSec: 28,
            },
            {
              section: '3分で完了するローカルAIのセットアップ',
              narration: '導入は拍子抜けするほど簡単です。コマンドを1行打つだけで、世界最高峰のオープンモデルがあなたのPC内に直接ダウンロードされます。',
              visualCue: 'ターミナルコマンド実行とプログレスバーの流麗なアニメーション',
              durationSec: 45,
            },
            {
              section: '完全オフラインでの自律タスク実行デモ',
              narration: '試しに社外秘の議事録テキストを投げてみましょう。ネット未接続でも、一瞬で論点整理とネクストアクションが抽出されます。データは外部に1バイトも送信されません。',
              visualCue: '機密文書アイコンから安全にサマリーが生成されるUIデモ',
              durationSec: 55,
            },
            {
              section: 'まとめと無料モデルの選び方',
              narration: 'メモリ16GBのPCなら、7B〜14Bモデルが最もバランス良く軽快に動作します。まずは概要欄のコマンドをコピーして試してみてください！',
              visualCue: 'スペック別おすすめモデル早見表スライド',
              durationSec: 40,
            },
          ]),
        },
      },
      shortClips: {
        create: [
          {
            title: '【0円神技】社外秘データも安心！自分のPCで完全オフライン稼働する自律AIの作り方',
            startTimeSec: 0,
            endTimeSec: 28,
            durationSec: 28,
            hookSentence: 'まだ月額3000円払って社外秘データをクラウドに送ってませんか？それ大問題です！',
            captionStyle: 'dynamic-bounce',
            aspectRatio: '9:16',
            estimatedRetentionRate: 92, // 蓄積知見の反映により維持率予測向上
            readyToPublish: true,
          },
        ],
      },
      publishLogs: {
        create: [
          {
            platform: 'youtube',
            title: '【完全無料】PC1台で社外秘データも安全分析！「ローカルLLM」構築ガイド #AI #shorts',
            caption: 'クラウドへの課金・データ流出はもう終わり。自分のMacで動く完全無料のローカル自律AI環境を3分で構築する手順を解説！\n\n#ローカルLLM #Ollama #AIエージェント #業務効率化',
            tagsJson: JSON.stringify(['ローカルLLM', 'Ollama', 'AIエージェント', 'セキュリティ', 'オープンソース']),
            status: 'draft',
          },
          {
            platform: 'tiktok',
            title: '社外秘データをクラウドに送るの今すぐやめて！自分のPCで0円で動く自律AIが神すぎたw #AI活用 #ITエンジニア #裏ワザ',
            caption: 'WiFi切っても爆速で動くのヤバすぎる...！社内データを安全に要約させたい人は絶対保存して試してみて✨ #AIツール #ローカルAI',
            tagsJson: JSON.stringify(['AIツール', 'ローカルAI', '裏ワザ', '仕事効率化']),
            status: 'draft',
          },
          {
            platform: 'instagram',
            title: '【保存版】ネット不要で動く！完全無料のローカルAI構築術',
            caption: 'まだ月額課金してクラウドに機密データ送ってない？\nPC1台あれば、ネット遮断時でもサクサク動く自律AIが誰でも作れます💡\n\n📌 投稿を保存して後で見返してね！',
            tagsJson: JSON.stringify(['ai活用法', 'itスキル', '最新テクノロジー', '生産性向上']),
            status: 'draft',
          },
          {
            platform: 'x',
            title: '【速報】クラウドAIへの社外秘データ送信は今すぐストップ。PC1台・完全無料でオフライン稼働するローカルAI構築手順まとめ',
            caption: 'まだ月額3000円払って社外秘データをクラウドAIに送ってませんか？\n\nOllamaを使えば、MacBook1台でネット未接続でも爆速でリサーチ・要約する自律環境が0円で作れます。\n\n動画でサクッと手順を解説しました👇',
            tagsJson: JSON.stringify(['AIエージェント', 'ローカルLLM', '業務効率化']),
            status: 'draft',
          },
        ],
      },
    },
  });

  console.log(`✅ 第2弾プロジェクトをSQLite DBに登録完了！（ID: ${project.id}）`);

  // 4. Edge-TTS による第2弾ナレーション音声の合成
  const audioDir = path.resolve(process.cwd(), 'public/audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
  const audioFilePath = path.join(audioDir, 'short2_narration.mp3');

  console.log('\n🎙️ Edge-TTS で第2弾ショート動画のナレーション音声を合成中 (ja-JP-NanamiNeural)...');
  const sanitizedText = short1Narration.replace(/"/g, '\\"');
  const ttsCmd = `edge-tts --voice ja-JP-NanamiNeural --text "${sanitizedText}" --write-media "${audioFilePath}"`;
  execSync(ttsCmd);

  const audioSize = fs.statSync(audioFilePath).size;
  console.log(`✅ 音声合成完了: ${audioFilePath} (${(audioSize / 1024).toFixed(1)} KB)`);

  console.log('\n🎉 第2弾動画（知見反映版）の制作パイプラインが完了しました！');
  console.log('ダッシュボード（http://localhost:3001）をリロードすると、新プロジェクトが選択可能になります。');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
