# YouTube 自動投稿の初回設定

エージェント CLI が YouTube に動画をアップロードし、再生数などを取得するための設定。**ユーザーが一度だけ行う。**

## 1. Google Cloud で OAuth クライアントを作る

1. [Google Cloud Console](https://console.cloud.google.com/) で、運用 Gmail（`omnipulsestudio@gmail.com`）を使ってプロジェクトを作成する。
2. 「API とサービス」→「ライブラリ」で、次の2つを有効にする。
   - YouTube Data API v3
   - YouTube Analytics API
3. 「OAuth 同意画面」を作成する。
   - ユーザーの種類は「外部」にする。
   - 「テストユーザー」に運用 Gmail を追加する。
   - 作成後、公開ステータスを **「本番環境」に切り替える**（審査の申請はしなくてよい）。
     - 「テスト」のままだと、リフレッシュトークンが7日で失効する。
     - 「本番環境」への切り替えには、**Branding ページでホームページ URL とプライバシーポリシー URL の入力が必要**（審査は不要）。
       - Authorized domains には、`github.io` ではなく **`miiiwa1121.github.io`** を登録する（`github.io` は共有ドメインのため登録できない）。
       - 本プロジェクトでは `gh-pages` ブランチで次のページを公開している（ソースはそのブランチ。main には含まれない）。
         - ホームページ: `https://miiiwa1121.github.io/sns/`
         - プライバシーポリシー: `https://miiiwa1121.github.io/sns/privacy.html`
     - 審査なしの本番環境では、許可画面に「Google はこのアプリを確認していません」と出る。自分で作ったアプリなので「詳細」→「（アプリ名）に移動」で進めてよい。
4. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」を選ぶ。
   - アプリケーションの種類は **デスクトップアプリ** にする。
   - 作成すると、クライアント ID とシークレットが表示される。

## 2. `.env.local` に書く

リポジトリ直下の `.env.local` に書く（Git には含まれない）。

```bash
YOUTUBE_CLIENT_ID="xxxx.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="GOCSPX-xxxx"
```

## 3. リフレッシュトークンを取得する（アカウントごと）

```bash
npm run youtube:auth -- <アカウントID>
# 例: npm run youtube:auth -- tuiteikunogaseiippai
```

- アカウント（チャンネル）ごとに、別の YouTube チャンネルで認証する。リフレッシュトークンは `.env.local` の `YOUTUBE_REFRESH_TOKEN__<アカウントID大文字>` に保存される。
- 認証したチャンネルの ID はアカウントの YouTube 連携（`PlatformConnection.apiConfig`）に記録される。投稿の直前に、認証先のチャンネルがこの ID と一致するか確認し、違えば投稿しない（別チャンネルへの誤投稿防止）。
- 別のアカウントに連携済みのチャンネルでは保存できない。
- 1〜2 の OAuth クライアント（クライアントID・シークレット）は全アカウントで共通。

1. 表示された URL をブラウザで開く。
   - アカウント選択では、Google アカウント本体ではなく、**YouTube のブランドアカウント（チャンネル）側**を選ぶ。
   - 「Google はこのアプリを確認していません」と出たら、「Advanced」→「Go to （アプリ名）(unsafe)」で進む。自分で作ったアプリなので問題ない。
   - 権限のチェックボックスはすべてチェックする。1つでも外すと、投稿または数値の取得が失敗する。
2. 完了すると、認証したチャンネル名が表示され、リフレッシュトークンが `.env.local` に保存される。
3. **表示されたチャンネル名が運用チャンネルであることを必ず確認する。**

## 制約

- **未審査の API プロジェクトからアップロードした動画は「非公開」に固定される。** YouTube の仕様で、[API 監査](https://support.google.com/youtube/contact/yt_api_form)に通るまでは公開・限定公開にできない。
  - そのため CLI の既定は `private` にしている。
  - 公開するときは、YouTube Studio で手動で「公開」に切り替える（2026-10-10、第1弾で切り替えられることを確認済み。ロックはされなかった）。
  - エージェントからの API での公開切り替えは、Claude Code の安全設定で止められる（一般公開は人の判断が必要な操作のため）。公開はユーザーが Studio で行う運用にする。
- OAuth 同意画面が「テスト」のままだと、リフレッシュトークンは **7日で失効** する（手順 1-3 で「本番環境」に切り替えておけば失効しない）。失効したら `npm run youtube:auth` をやり直す。
- 手動で YouTube にアップロードした動画でも、`publish:record <projectId> youtube <URL>` で記録すれば、URL から動画IDを取り出して `metrics:collect` で実測値を自動取得できる。
- アップロードは API クォータを大きく消費する（執筆時点で1本あたり約1,600ユニット、既定の上限は 10,000 ユニット/日。最新値は Google の公式ドキュメントで確認する）。
