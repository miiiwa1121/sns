# アーキテクチャ設計一覧 (architecture)

本ディレクトリは、OmniPulse AI Studio のシステムアーキテクチャ、データモデル、パイプライン連携を記録・管理するディレクトリです。

## ドキュメント一覧

- [data-model.md](data-model.md): マルチアカウント対応ER図およびPrisma/SQLiteスキーマ詳細
- [publishing-pipeline.md](publishing-pipeline.md): マルチSNS自動配信パイプライン設計およびYouTube/TikTok/IG/X API連携仕様
- [analytics-pdca.md](analytics-pdca.md): 自律PDCAループ & CriticAI ナレッジ蓄積アーキテクチャ詳細
- [directory-structure.md](directory-structure.md): リポジトリのディレクトリ構成と、生成物の保管場所（`data/`）・配信の仕組み
- [video-template.md](video-template.md): ショート動画テンプレートの構成図（制作パイプライン・画面レイアウト・場面の種類・デザイン方針・声）
- [autonomous-cron.md](autonomous-cron.md): 完全自律モード (Auto-Pilot) & 無人巡回スケジューラー設計詳細
- [ai-manager.md](ai-manager.md): AI マネージャー（人と OmniPulse Studio のあいだに立つ窓口の AI）の設計。未実装
