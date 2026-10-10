# ディレクトリ構成と生成物の保管場所

リポジトリのトップレベルの役割と、動画・音声などの生成物を `data/` にまとめる方針を記録する。

## 1. トップレベル

| ディレクトリ | 役割 | git |
| :-- | :-- | :-- |
| `src/` | Next.js（管理画面・API・DB アクセス・配信処理）。`src/lib/storage.ts` が生成物の場所を定義する | 管理 |
| `agent/` | エージェント運用 CLI（`npm run agent`）。リサーチ登録・制作（`produce.ts`）・承認・配信・計測。管理画面からの依頼を動かす `job-runner.ts` もここ | 管理 |
| `remotion/` | ショート動画のテンプレート（Remotion）と、その固定素材（`remotion/public/`）。`produce` が `remotion render` で呼ぶ。Next.js からは import されない | 管理 |
| `remotion/public/` | 動画の固定素材（`brand/` アイコン、`se/` 効果音、BGM を使うならここ）。Remotion の公開ディレクトリ | 管理 |
| `data/` | **生成物**（動画・音声・作業ファイル・依頼ジョブのログ）。詳細は次節 | 管理外 |
| `prisma/` | スキーマ。DB 本体 `dev.db` は管理外 | 一部管理 |
| `scripts/` | 単発のセットアップ用スクリプト（アカウント作成など）。恒常的な処理は `agent/` に置く | 管理 |
| `docs/` | ドキュメント。`docs/videos/` は動画ごとの絵コンテ | 管理 |

## 2. `data/`（生成物）

```
data/
  projects/<projectId>/        1企画 = 1フォルダ
    video.mp4                  完成動画（配信対象）
    thumb.jpg                  サムネイル
    work/                      作業ファイル
      props.json               Remotion に渡した台本データ
      preview.png              確認用静止画（字幕1行1コマ）
      manual/                  手動投稿パッケージ（video.mp4・captions.md）
      stage/                   レンダリング用の一時素材。成功すると自動で消える
  jobs/<jobId>/                画面からの依頼の作業フォルダ（prompt.md・project.json・log.jsonl）
  scratch/                     手作業のリサーチ・台本の JSON など。置き場所は自由
```

- 企画を片付けるときは `data/projects/<projectId>/` をフォルダごと消せばよい。古いものの削除は `npm run agent -- clean`（[runbook 9](../operations/agent-runbook.md)）。画面の「企画を削除」は DB の行とこのフォルダを一緒に消す。
- `<projectId>` などの ID は Prisma の `cuid()` が作る DB の主キーで、意味のある名前ではない。
- DB の `ShortClip.renderedFilePath` には `data/` からの相対パス（`projects/<id>/video.mp4`）を保存する。DB が持つのは場所だけで、ファイル本体は `data/` にある。DB の行を消してもファイルは消えない（逆も同じ）。
- パスの組み立ては `src/lib/storage.ts` に集約している。直接 `data/...` を書かない。

## 3. 配信の仕組み

Next.js は `public/` に置くと URL でそのまま配信するが、生成物はそこに置かず、Route Handler `GET /api/media/[...path]`（`src/app/api/media/[...path]/route.ts`）が返す。

- 返すのは `projects/<id>/video.mp4` と `projects/<id>/thumb.jpg` だけ。`work/` や他のファイル、`data/` の外は 404。
- Range リクエストに応える（プレーヤーのシークと、Instagram による動画の取得のため）。
- 用途: 管理画面のプレーヤー、Instagram Reels に渡す動画 URL。
- 認証はない。開発サーバーを `127.0.0.1` にバインドしている前提で、公開サーバーに置く場合は別途保護が必要。

## 4. Remotion の素材

Remotion の `staticFile()` は「公開ディレクトリ」を基準にする。`produce` は次の一時フォルダを作り、`--public-dir` で渡す。

```
data/projects/<id>/work/stage/
  brand/ se/ ...    remotion/public/ をそのままコピー（固定素材・BGM）
  audio/line-NN.mp3 この動画のナレーション
```

レンダリングが成功すると `stage/` は削除する（失敗時は調査のため残す）。Remotion Studio で見るときは `remotion/public/` が公開ディレクトリになる（`remotion.config.ts`）。

ルート直下の `public/`（Next.js の静的ファイル置き場）は使っていない。管理画面は画像や動画を `public/` から配信しないため（動画は第3節の Route Handler）。
