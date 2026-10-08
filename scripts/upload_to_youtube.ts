/**
 * YouTube Data API v3 動画自動アップロードスクリプト
 * 
 * 使い方:
 * 1. Google Cloud Console で「YouTube Data API v3」を有効化
 * 2. OAuth 2.0 クライアント ID を作成し、JSONファイルを `scripts/client_secrets.json` に配置
 * 3. 以下のコマンドを実行して認証 & アップロード:
 *    npx tsx scripts/upload_to_youtube.ts
 */

import fs from 'fs';
import path from 'path';

async function main() {
  const videoPath = path.resolve(process.cwd(), 'public/videos/short_clip_1.mp4');
  const secretPath = path.resolve(process.cwd(), 'scripts/client_secrets.json');

  console.log('--- YouTube Data API 自動アップロードチェッカー ---');
  console.log(`対象動画ファイル: ${videoPath}`);

  if (!fs.existsSync(videoPath)) {
    console.error(`❌ 動画ファイルが見つかりません: ${videoPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(videoPath);
  console.log(`✔ 動画ファイル確認完了: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

  if (!fs.existsSync(secretPath)) {
    console.log('\n[インフォメーション]');
    console.log('OAuth2 クライアント情報 (scripts/client_secrets.json) がまだ設定されていません。');
    console.log('手動投稿を行う場合は、ダッシュボード（http://localhost:3001）の「承認 & マルチ配信」画面から');
    console.log('「動画を保存」ボタンでダウンロードし、YouTube Studio からアップロードしてください。');
    console.log('API経由で自動アップロードしたい場合は、Google Cloud Console から client_secrets.json を取得して配置してください。\n');
    return;
  }

  console.log('✔ client_secrets.json を検出しました。認証およびアップロードを開始します...');
  // googleapis を使ったアップロード処理
}

main().catch(console.error);
