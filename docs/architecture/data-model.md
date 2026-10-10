# データモデル設計 (Data Model)

本ドキュメントでは、OmniPulse AI Studio のマルチアカウント対応データベース（SQLite + Prisma ORM）のエンティティ関係（ER）および各テーブルの責務を定義する。

---

## 1. ER図 (Entity-Relationship Diagram)

```mermaid
erDiagram
    Account ||--o{ PlatformConnection : "1:N (各SNS接続)"
    Account ||--o{ Project : "1:N (動画企画)"
    Account ||--o{ TrendResearch : "1:N (リサーチ履歴)"
    Account ||--o{ AgentKnowledge : "1:N (チャンネル固有AI学習メモリ)"

    Project ||--o| LongFormVideo : "1:1 (長尺マスター動画)"
    Project ||--o{ ShortClip : "1:N (切り抜きショート動画群)"
    Project ||--o{ PublishLog : "1:N (配信予約・投稿実績)"
    Project ||--o{ AnalyticsMetric : "1:N (効果測定)"

    ShortClip ||--o{ PublishLog : "1:N"
```

`AgentJob`（依頼）、`StructureTemplate`（構成案）、`AppSetting`（サービス全体の設定）は図に含めていない。

---

## 2. 各テーブルの責務と主要カラム

### 1. `Account` (チャンネル / ブランドアカウント)
1つの組織・ユーザーが複数の異なるチャンネル（例: 「AI速報スタジオ」「ゼロから始めるITキャリア」）を運用するための最上位エンティティ。
- `id` (String / CUID): 一意キー
- `name` (String): アカウント表示名
- `slug` (String, Unique): URL/識別用スラッグ
- `category` (String): メインカテゴリ（例: `AI・IT`）
- `concept` (String): チャンネルの基本コンセプト
- `targetAudience` (String): ペルソナ・ターゲット層
- 話し方・台本のルールは持たない（構成案で決める。2026-10-10 に移した）
- `defaultTemplateId` (String?): 既定の構成案（`StructureTemplate`）。依頼時に選び直せる。未設定なら構成案一覧の先頭を使う
- `isActive` (Boolean): 有効フラグ

### 2. `PlatformConnection` (SNS連携情報)
アカウントごとに紐づく各SNSの接続状態とクレデンシャル。
- `id`: 一意キー
- `accountId`: 紐づくAccount
- `platform`: `youtube` | `tiktok` | `instagram` | `x`
- `handle`: アカウント識別子（例: `@ai_pulse_lab`）
- `apiConfig`: トークン等の設定JSON
- `isConnected`: 接続状態フラグ

### 3. `TrendResearch` (トレンドリサーチ履歴)
エージェントが Web 検索で調べた話題（`npm run agent -- trend:add`）。
- `id`: 一意キー
- `accountId`: 対象Account
- `templateId`: 台本づくりに使った構成案（依頼から引き継ぐ。分析で構成案ごとに比べるため）
- `topic`: トレンドトピック名
- `category`: カテゴリ
- `buzzScore`, `searchVolume`, `trendVelocity`: 実測できた場合のみ。推測値は入れず null にする
- `suggestedAngle`: 動画の切り口
- `summary`: 調べて分かった事実の要約
- `sourcesJson`: 出典 `[{ title, url }]`（CLI からの登録では必須）

### 4. `Project` (動画企画プロジェクト)
1つの動画企画のルート。長尺動画と複数の切り抜きショートを束ねる。
- `id`: 一意キー
- `accountId`: 対象Account
- `title`: 企画タイトル
- `concept`: 企画詳細
- `stage`: `research` | `production` | `review` | `published` | `analyzed`
  - `production`: 台本あり・未レンダリング / `review`: レンダリング済み・承認待ち / `published`: 1媒体以上で配信済み / `analyzed`: 実測値で分析済み
- `trendResearchId`: 元になったリサーチ（出典の追跡用、任意）

### 5. `LongFormVideo` (長尺動画マスター)
YouTube向けの横型マスター動画。
- `id`: 一意キー
- `projectId`: 紐づくProject (1:1)
- `title`: 長尺タイトル
- `description`: 概要欄テキスト
- `durationSec`: 総尺（秒）
- `thumbnailUrl`: サムネイル画像URL
- `status`: `drafting` | `rendered` | `approved` | `published`
- `scriptJson`: チャプター分割・ナレーション・ト書きの配列JSON

### 6. `ShortClip` (切り抜きショート動画)
長尺から自動抽出された縦型（9:16）ショート動画。
- `id`: 一意キー
- `projectId`: 紐づくProject (1:N)
- `title`: ショートタイトル
- `startTimeSec`, `endTimeSec`: 切り抜き区間
- `durationSec`: 秒数（30〜60秒）
- `hookSentence`: 冒頭1〜2秒の強力なフックセリフ
- `captionStyle`: テロップスタイル（`dynamic-bounce` 等）
- `aspectRatio`: デフォルト `9:16`
- `estimatedRetentionRate`: 予測視聴維持率（%）
- `scriptJson`: ショートの台本 `[{ text, caption? }]`。1要素 = 読み上げ1行 = 字幕1枚
- `renderedFilePath`: レンダリング済み MP4 の `data/` からの相対パス（例: `projects/<id>/video.mp4`）。`POST /api/publish` はこのファイルを配信する
- `readyToPublish`: 配信対象かどうか

### 7. `PublishLog` (配信ログ & スケジュール)
プラットフォーム別の投稿スケジュールと配信結果。
- `id`: 一意キー
- `projectId`: 紐づくProject
- `shortClipId`: 紐づくShortClip（ショートの場合）
- `platform`: `youtube` | `tiktok` | `instagram` | `x`
- `title`, `caption`, `tagsJson`: プラットフォーム最適化メタデータ
- `status`: `draft` | `scheduled` | `published` | `failed`
- `postUrl`: 投稿後の実URL（API が URL を返した場合、または手動投稿を `publish:record` で記録した場合）
- `externalId`: プラットフォーム側の動画ID（YouTube の videoId 等）。実測値の自動取得に使う
- `errorMessage`: `failed` の理由（認証未設定・APIエラー・未実装）
- `scheduledAt`, `publishedAt`: 予約・公開日時

### 8. `AnalyticsMetric` (アナリティクス実績)
投稿後の効果測定データ。
- `id`: 一意キー
- `projectId`: 紐づくProject
- `platform`: プラットフォーム
- `views`: 再生回数
- `retentionRate`: 視聴維持率（%）。未取得なら null（0 を入れない）
- `likes`, `shares`, `comments`: エンゲージメント数
- `engagementRate`: エンゲージメント率（%）
- `topComment`: 代表的なコメント

### 9. `AgentKnowledge` (CriticAIのチャンネル別学習メモリ)
アナリティクス分析から得られた「このチャンネルでバズる法則」。アカウントごとに独立蓄積される。
- `id`: 一意キー
- `accountId`: 対象Account
- `category`: `hook` | `tempo` | `topic` | `cta`
- `ruleText`: 学習知見ルール
- `confidenceScore`: 信頼度スコア (0.0〜1.0)
- `appliedCount`: 次回企画への適用回数

### 10. `StructureTemplate` (動画の構成案)
指示書（`agent/job-prompt.ts`）のうち「構成」の部分。全アカウント共通の一覧で、管理画面の「構成案」で編集する。1件もなければ既定（「標準（30〜50秒）」）を自動で作る。
- `name` / `description`: 名前と一覧に出す説明
- `body`: 指示書の「構成案」節にそのまま入る構成の指示（尺・行数・流れ・場面の選び方など）
- コマンド・手順・禁止事項・事実と出典のルールは指示書に固定で、構成案からは変えられない。

`AgentJob`（依頼）には `templateId` に加えて、依頼した時点の `templateName` / `templateBody`（写し）を保存する。構成案をあとで編集・削除しても、どの内容で作ったかが分かるようにするため。実行時の指示書もこの写しから作る。

### 11. `TemplateWorkshop` / `TemplateWorkshopMessage` (構成案の相談)
構成案を AI と相談しながら作る場。`TemplateWorkshop` は、直している構成案（`templateId`。名前・説明・構成の指示はこちらが持つ。構成案を消すと相談も消える）、前提にするアカウント、複製の元にした構成案（`baseTemplateId`）を持つ。相談を始めた時点で構成案を作る（名前がなければ sample1, sample2 …、既存から始めるときは「◯◯ のコピー」）。
`TemplateWorkshopMessage` は1発言。
- `role`: `user` | `assistant`、`kind`: `chat`（相談）| `sample`（試作）
- `status`: AI の発言は `pending` で作り、`agent/workshop-runner.ts` が `done` / `failed` にする
- `proposedBody`: AI が出した構成の指示の修正案（構成案に保存済み）
- `sampleTopic` / `sampleJson`: 試作の話題と台本 `{ title, lines }`

### 12. `AppSetting` (サービス全体の設定)
1行だけのテーブル（`id = "app"`。無ければ初回読み込み時に既定値で作る）。管理画面の「設定」で編集する。
- `cleanupAuto`: 動画づくりの依頼が終わるたびに自動で整理するか（既定 false）
- `cleanupDays`: YouTube 公開・依頼の終了からこの日数がたったものを整理する（既定 30）
- `cleanupIncludeVideo`: 作業ファイルに加えて動画・サムネも消すか（既定 false）
- `lastCleanupAt` / `lastCleanupBytes`: 最後に整理した日時と、消した量（バイト）

---

## 3. ストレージと環境
- **DBエンジン**: SQLite (`file:./prisma/dev.db`)
- **スキーマ定義ファイル**: `prisma/schema.prisma`
- **クライアント生成**: `npx prisma generate`（`src/lib/prisma.ts` 経由で呼び出し）
- **クラウド移行性**: `schema.prisma` の `datasource db` を PostgreSQL / Supabase の接続URLに差し替えるだけで、スキーマやモデルコードを1行も変えずにクラウドDBへ移行可能。
