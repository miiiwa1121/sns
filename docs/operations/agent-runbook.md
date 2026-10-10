# エージェント運用手順書（リサーチ → 投稿 → 分析）

Claude Code セッション（以下、エージェント）が「ついていくのが精一杯」の動画を1本作って出し、結果を学習するまでの手順。セッションが変わっても、この手順書と `npm run agent -- status` だけで続きから再開できるようにしている。

検証の範囲と判断は [Decision 010](../requirements/decisions.md) を参照。

---

## 0. 前提

- 作業はリポジトリ直下で行う。コマンドはすべて `npm run -s agent -- <command>`。
- 必要なツール: VOICEVOX エンジン（`~/.local/share/voicevox/macos-arm64/`。[公式 GitHub](https://github.com/VOICEVOX/voicevox_engine/releases) の macos-arm64 版を 7-Zip で展開）、`ffmpeg` / `ffprobe`、Google Chrome（レンダリングに使う）。
- YouTube 自動投稿の設定は [youtube-setup.md](youtube-setup.md)。未設定でも、投稿以外の工程は回せる。
- 一時ファイル（リサーチや台本の JSON）は `data/scratch/`（Git 管理外）に置く。生成物の置き場所は [ディレクトリ構成](../architecture/directory-structure.md) を参照。

## 1. 状況確認

```bash
npm run -s agent -- status
```

各プロジェクトに「次:」として次の手順が表示される。途中のプロジェクトがあれば、新しく作る前にそれを進める。

## 2. リサーチ

1. Web 検索で、直近の AI・IT の話題を調べる。
   - **一次情報（公式発表・公式ブログ・論文・リリースノート）を最低1件含める。**
   - まとめ記事だけで判断しない。
2. 「ついていくのが精一杯な人」が知っておくべき度合いで、1本に絞る。
3. `data/scratch/trend.json` を書いて登録する。

```json
{
  "topic": "話題の名前",
  "angle": "この動画で伝える切り口（1文）",
  "summary": "調べて分かった事実の要約。数字・日付は出典どおりに書く",
  "sources": [
    { "title": "公式発表のタイトル", "url": "https://..." }
  ]
}
```

```bash
npm run -s agent -- trend:add data/scratch/trend.json
```

- `buzzScore` などの推測値は入れない。
- 出典が無いと登録できない。

## 3. 台本と投稿文

まず蓄積された知見を確認する。

```bash
npm run -s agent -- knowledge
```

次に `data/scratch/project.json` を書く。

```json
{
  "trendId": "trend:add で出た ID",
  "title": "画面上部に出るタイトル（短く）",
  "concept": "この動画の狙い",
  "lines": [
    {
      "text": "読み上げる文",
      "caption": "字幕（省略時は text と同じ。\\n で改行）",
      "emphasis": ["字幕の中で強調する語"],
      "mood": "surprised",
      "scene": { "type": "hook", "text": "冒頭の大きな文字", "sub": "バッジ" }
    }
  ],
  "publish": {
    "youtube": { "title": "100文字以内 #Shorts", "description": "概要欄。出典URLを入れる", "tags": ["AI"] },
    "tiktok": { "caption": "本文", "tags": ["AI"] },
    "instagram": { "caption": "本文", "tags": ["AI"] },
    "x": { "text": "本文（日本語140字程度まで）" }
  }
}
```

- `scene` の種類と項目、`mood` の種類は [video-template.md](../architecture/video-template.md#4-場面の種類srcremotiontypestsのscene) を参照。`scene` を省略した行は直前の場面を引き継ぐ。
- 実例: [docs/videos/](../videos/README.md) の絵コンテ。

### 台本の書き方

- **尺は 30〜50 秒**（読み上げ +10% 速で、1行あたり約2〜5秒、8〜14行が目安）。
- 1行目で「何の話か」と「なぜ今か」を言う。
- 専門用語には、1行の比喩か言い換えを添える（アカウントのコンセプト）。
- **事実は出典に書いてあることだけにする。** 推測で数字を作らない。
- 読み間違えやすい語は `text` をカタカナにして、`caption` に正しい表記を書く（例: `"text": "ジーピーティー"`, `"caption": "GPT"`）。
- 字幕は `\n` で区切った1行が全角13字程度までになるよう書く。文字サイズは一番長い行が1行に収まるよう自動で決まる（長すぎる行は小さくなる）。
- 1行目は `hook` 場面で、手を止めさせる一言にする（「〇〇になりました」ではなく「〇〇、もう△△じゃない」など）。
- 絵文字・スタンプは使わない。伝えたいことは UI 部品の場面（`chat` / `timeline` / `chips` / `select` / `compare`）で見せる。
- 実際のサービス画面は使わない（`chat` は汎用の再現で「※イメージ」と表示される）。
- 声はずんだもん（VOICEVOX）。**特定の企業・人物を応援・批判する言い回しはしない**（ずんだもんの利用規約の禁止事項）。事実の紹介に留める。
- 最後の行は締めの一言にする。CTA（「フォローしてね」など）は入れても入れなくてもよい。

```bash
npm run -s agent -- project:create data/scratch/project.json
```

## 4. 制作

```bash
npm run -s agent -- produce <projectId>
```

- 出力は次の3つ。
  - 動画: `data/projects/<projectId>/video.mp4`
  - 確認用静止画: `data/projects/<projectId>/work/preview.png`（字幕1行につき1コマを6列で並べた一覧）
  - 絵コンテ: `docs/videos/<日付>-<projectId>.md`（構成の記録。配信後は URL も反映される）
- 台本を直すときは `project:update <projectId> <file.json>` で差し替えて、`produce` し直す（配信前のみ）。
- 声と速度は既定でずんだもん・1.15。VOICEVOX エンジンは `produce` が自動で起動・停止する。
- **静止画を Read で必ず確認し、次の点を自分で点検する。**
  - 字幕のはみ出し
  - 不自然な改行
  - 誤字
  - タイトルの切れ
- 問題があれば `project.json` を直す。プロジェクトの作り直しが必要な場合は、新しく `project:create` する。

## 5. 承認（人間の判断）

ユーザーに次の3点を見せ、**公開してよいか明示的に聞く。**
- `data/projects/<projectId>/video.mp4` のパス
- 静止画
- 台本と出典

OK をもらったときだけ承認する。

```bash
npm run -s agent -- approve <projectId>
```

- エージェントが自分の判断で `approve` してはいけない（Decision 002 / 010）。
- 管理画面からの依頼で AI が作業しているあいだ（Antigravity は完了・中止から30分も）は、`approve`・`publish`・`publish:record`・`metrics:*`・`analyze` をコマンドからは実行できない（Decision 019）。管理画面のボタンからは実行できる。
- 作り直し（`produce`）すると承認は外れる。

## 6. 配信

### YouTube（API で自動）

```bash
npm run -s agent -- publish <projectId> --platforms youtube
```

- 既定は `private`。未審査の API プロジェクトでは、公開・限定公開にできないため（[youtube-setup.md](youtube-setup.md)）。
- ユーザーに、YouTube Studio で「公開」に切り替えてもらう。

### TikTok / Instagram / X（手動）

```bash
npm run -s agent -- export:manual <projectId>
```

1. `data/projects/<projectId>/work/manual/` の `video.mp4` と `captions.md` をユーザーに渡し、投稿してもらう。
2. 投稿 URL を聞いて記録する。

```bash
npm run -s agent -- publish:record <projectId> tiktok https://www.tiktok.com/@.../video/...
```

## 7. 計測と分析（公開から1〜2日後）

```bash
# YouTube は API で取得（平均視聴率は反映まで1〜2日かかる。手動投稿でも publish:record で URL を記録していれば取れる）
npm run -s agent -- metrics:collect <projectId>

# 他の媒体は、ユーザーにアプリのインサイトの数字を聞いて手入力
npm run -s agent -- metrics:record <projectId> data/scratch/metrics.json

# 分析。総再生1,000回以上なら知見として保存される
npm run -s agent -- analyze <projectId> --save-knowledge
```

`metrics.json` は次の形式で書く。`retentionRate` は分からなければ省略する。0 を入れない。

```json
{ "platforms": [
  { "platform": "tiktok", "views": 0, "likes": 0, "shares": 0, "comments": 0, "engagementRate": 0, "retentionRate": 0 }
] }
```

## 8. 記録

1本回したら、`docs/devlog/yyyymmdd.md` に次の4点を書く。
- 選んだ話題と理由
- 詰まった工程
- 人手が必要だった箇所
- 所要時間

人手が必要だった箇所は、自律化を進めるうえでの課題リストになる。

---

## 9. 生成物の整理（人が管理画面で行う）

`data/` は放っておくと増え続ける。整理は管理画面の **「設定」**（`/settings`）で行う。エージェントは整理しない。

- 画面に、保存しているファイルの容量と、今のルールで消える対象の一覧が出る。
- ルール: 「YouTube に公開して（依頼が終わって）から何日たったら整理するか」（既定30日）、「動画とサムネも消す」（既定オフ。オフなら作業ファイルだけ）。
- 「自動で整理する」をオンにすると、動画づくりの依頼が終わるたびに自動で整理する。
- 「整理する」ボタンで今すぐ実行できる（確認ダイアログあり。元に戻せない）。
- DB の行は消さない。動画を消した企画は、画面に「動画ファイルは整理（clean）で削除済み」と出る。
- 企画の画面の「この企画を削除する」（未投稿の企画のみ）は、DB の行と `data/projects/<id>/` をまとめて消す。

## 人手が必要な箇所（2026-10-09 時点）

| 工程 | 人手が要る理由 |
| :--- | :--- |
| 承認 | 方針として人間が判断する（Decision 002） |
| YouTube の公開切り替え | 未審査 API プロジェクトは非公開に固定されるため |
| TikTok / Instagram / X の投稿 | API の審査・有料プラン・公開URLのホスティングが必要なため |
| 他媒体の実測値 | 同上（API 未接続） |
