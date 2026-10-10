<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — sns (OmniPulse AI Studio) 開発ガイド

このリポジトリで作業する際の前提とルールを定義する。AIエージェントはセッション開始時に本ファイルを自動で読み込み、遵守すること。

## プロジェクト概要

YouTube、X (Twitter)、Instagram、TikTok への動画投稿を自律的に行うAIアシスタント基盤。
動画内容のリサーチから、長尺動画台本・切り抜きショート制作、マルチSNS投稿、アナリティクス検証・自律PDCAまでを一貫して行う。

## ミッション

1. **プロダクトの実装**
2. **docs の作成**

docs は実装の副産物ではなく、実装と同格の成果物として扱う。機能を実装・改修したら、対応する docs の更新まで終えて「完了」とする。

## docs のルール

### 1. devlog を残す

**随時**、`docs/devlog/` 直下へログを残す。

- ファイル名は `yyyymmdd.md`（例: `docs/devlog/20261008.md`）
- 同日中は同一ファイルに**追記**する（作り直さない）
- **実装に限らない。**要件・設計・調査など、作業したら書く
- 何を・なぜ・どう作業したか、詰まった点、判断を変えた点、次にやることを書く
- 決定事項そのものは `docs/requirements/decisions.md` に書く。devlog は「その日に何が起きたか」の記録

### 2. ディレクトリには README を置く

`docs/` 内にディレクトリを作成するたび、そのディレクトリ直下に `README.md` を配置し、**目次**として使う。ディレクトリの中身を作る前に README を作る。

### 3. ファイル冒頭にタイトルを書く

すべてのファイルの先頭に、そのファイルが何のファイルなのかを示すタイトル（`# タイトル`）を書く。

### 4. 言語と粒度

docs は**日本語**で、実務レベル一式を揃える（要件定義 / 設計 / データモデル / API / セットアップ / 開発ガイド）。

## 参照範囲

**このリポジトリ以外は参照しない。** `~/Desktop/dev/` 配下の他プロジェクト（plavo, playable, gurudis など）は本プロジェクトとは無関係な別サービスであり、設計や docs の根拠に使わないこと。

## 技術スタック

- **フロントエンド / バックエンド**: Next.js (App Router, Turbopack, TypeScript)
- **UI スタイリング**: Vanilla CSS (CSS Variables, グラスモーフィズム, レスポンシブ)
- **データベース / ORM**: SQLite (ローカル永続化: `prisma/dev.db`), Prisma ORM (v6)
- **アイコン**: Lucide React
- **エージェント・推論**:
  - 検証フェーズ（現在）: 半自律型（Gemini 3.8 Flash直接駆動によるリサーチ・台本生成・PDCA）
  - 本番フェーズ: Claude 3.7 / Gemini Flash API 等への移行可能設計
- **動画制作エンジン**: Remotion (9:16縦型ショートプレビュー / レンダリング)

## ディレクトリ構成

`src/`（Next.js）、`agent/`（エージェント CLI）、`remotion/`（動画テンプレート）、`remotion/public/`（動画の固定素材）、`data/`（生成物。git 管理外）。生成物は `data/projects/<id>/` に企画ごとにまとまる。詳細は [docs/architecture/directory-structure.md](docs/architecture/directory-structure.md)。

## 主要コマンド

```bash
# 依存関係インストール
npm install

# 開発サーバー起動 (127.0.0.1:3001 にバインド。LAN には公開しない)
npm run dev

# ビルド & 型チェック
npm run build

# データベースマイグレーション反映
npx prisma db push

# エージェント運用 CLI（リサーチ→台本→制作→承認→配信→計測→分析）
# 手順: docs/operations/agent-runbook.md
npm run -s agent -- status

# ⚠️ prisma/seed.ts は全データを削除して架空のデモアカウントを入れる。実運用DBでは実行しないこと

# Prisma Studio (DB GUI閲覧)
npx prisma studio
```
