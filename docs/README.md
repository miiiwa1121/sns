# ドキュメント一覧 (docs)

本ディレクトリは、YouTube・X・Instagram・TikTok 自律動画エージェント基盤「OmniPulse AI Studio」の設計・要件・開発ログを管理するドキュメントルートです。

## ディレクトリ構成

- **[requirements/](requirements/README.md)**: 要件定義・仕様および決定事項の記録
  - [decisions.md](requirements/decisions.md): プロジェクトの重要決定事項（アーキテクチャ・運用方針・データ保持方針など）
  - [dashboard-ui.md](requirements/dashboard-ui.md): 管理画面 UI の要件（要件定義中）
- **[architecture/](architecture/README.md)**: システムアーキテクチャ・データモデル設計
  - [directory-structure.md](architecture/directory-structure.md): ディレクトリ構成と生成物の保管場所（`data/`）
  - [data-model.md](architecture/data-model.md)
  - [video-template.md](architecture/video-template.md): ショート動画テンプレートの構成図: マルチアカウント対応ER図およびPrisma/SQLiteスキーマ詳細
- **[operations/](operations/README.md)**: 運用手順書
  - [agent-runbook.md](operations/agent-runbook.md): エージェントがリサーチから投稿・分析までを回す手順
  - [youtube-setup.md](operations/youtube-setup.md): YouTube 自動投稿の初回設定
- **[videos/](videos/README.md)**: 動画ごとの絵コンテ（構成の記録。produce で自動作成）
- **[brand/](brand/README.md)**: アイコン等のブランド資産仕様
  - [icon.md](brand/icon.md): SNSアカウントアイコンのコンセプト・配色・書き出しファイル
- **[devlog/](devlog/README.md)**: 開発・調査・設計の作業日報（日次ログ）
  - [20261008.md](devlog/20261008.md): プロジェクト立ち上げ・全体設計・マルチアカウントローカルDB構築の記録
