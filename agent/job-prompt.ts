// 管理画面からの「動画づくりの依頼」で AI に渡す指示書。工程ごとに分かれる（2026-10-11 から）。
//   リサーチ: Claude Code が Web で調べて trend:add で登録する（道具を使って作業を進める）
//   台本    : 選んだ AI（Claude Code / Claude API / Gemini API）が JSON を1回返す。登録は agent/job-runner.ts が行う
//   点検    : Claude Code が確認用の静止画を見て、必要なら直して作り直す
// 制作（音声合成とレンダリング）はシステムが行うので、指示書はない。

export interface JobPromptInput {
  jobId: string;
  repoDir: string; // リポジトリの絶対パス
  workDir: string; // この依頼の作業フォルダ（台本などの JSON を置く）
  theme: string | null;
  channel: {
    slug: string;
    name: string;
    concept: string;
    targetAudience: string;
  };
  // 構成案（管理画面の「構成案」で編集する部分）。台本の指示書の「構成案」節にそのまま入る
  template: { name: string; body: string };
  // リサーチ手法（管理画面の「リサーチ手法」で編集する部分）。リサーチの指示書の「リサーチ手法」節にそのまま入る
  researchMethod: { name: string; body: string };
  // 依頼で選んだ禁止事項（管理画面の「禁止事項」）。どの工程の指示書にも入る
  prohibitions: string[];
}

// 台本の担当に渡す制作の設定。null は「おまかせ」（選択肢の中から台本の担当が選ぶ）
export interface ProducePromptInput {
  request: { voice: string | null; speed: number | null; bgm: string | null };
  voices: { id: string; label: string }[];
  speeds: number[];
  bgms: { id: string; label: string }[];
  charsPerSecAt1x: number; // 読み上げの1秒あたりの字数（速さ1倍のとき）
}

export interface ResearchResult {
  topic: string;
  angle: string;
  summary: string;
  sources: { title: string; url: string }[];
}

const agentCmd = (repoDir: string) => `npm --prefix ${repoDir} run -s agent --`;

function channelSection(i: JobPromptInput): string {
  return `## チャンネル
- コンセプト: ${i.channel.concept}
- 視聴者: ${i.channel.targetAudience}`;
}

function prohibitionSection(i: JobPromptInput): string {
  const items = i.prohibitions.map((p) => p.trim()).filter(Boolean);
  if (items.length === 0) return '';
  return `## 禁止事項
次のことはしないでください。

${items.map((p) => `- ${p}`).join('\n')}
`;
}

function commandSection(i: JobPromptInput, commands: string[]): string {
  return `## 使えるコマンド（これ以外のコマンドは使わないでください）
${commands.map((c) => `- \`${agentCmd(i.repoDir)} ${c}\``).join('\n')}

JSON ファイルは作業フォルダ \`${i.workDir}\` に書き、コマンドには絶対パスで渡してください。
**コマンドは1回に1つずつ実行し、パイプ（|）や && でつながないでください**（許可の判定で拒否されることがあります）。`;
}

// 報告を英語で書いたことがあった（2026-10-11、点検の工程）。どの工程でも冒頭で言い切る
const JAPANESE = '**報告・作業中の説明・ファイルに書く文章は、すべて日本語で書いてください。**';

function sourceList(sources: { title: string; url: string }[]): string {
  return sources.map((s) => `- ${s.title} ${s.url}`).join('\n');
}

// 台本の決まり（固定）。台本の工程と、点検で直すときに使う
const SCRIPT_RULES = [
  '字幕（caption）は \\n で区切った1行が全角13字程度まで。読み間違えやすい英語は text をカタカナにし、caption に正しい表記を書く。',
  '**事実はリサーチの結果に書いてあることだけ**。推測で数字を作らない。食い違う情報は断定しない。',
  '特定の企業・人物を応援・批判する言い回しはしない（声の利用規約）。事実の紹介に留める。',
  'チャット画面は再現（※イメージ）なので、実在サービスの画面だと誤解させる書き方をしない。',
];

/** リサーチの工程（Claude Code）。調べて登録したら終わる */
export function buildResearchPrompt(i: JobPromptInput): string {
  const theme = i.theme?.trim() ? `お題: 「${i.theme.trim()}」` : 'お題: おまかせ';
  return `# 動画づくりの依頼（依頼ID: ${i.jobId}）: リサーチ

あなたは YouTube ショートのチャンネル「${i.channel.name}」のリサーチ担当です。話題を1つ選んで調べ、リサーチとして登録したら終えてください。台本と動画は、次の工程で別の担当が作ります。

${JAPANESE}

${channelSection(i)}

## 今回の依頼
${theme}

## リサーチ手法: ${i.researchMethod.name}
${i.researchMethod.body.trim()}

${commandSection(i, [`status --account ${i.channel.slug}`, `trend:add <file.json> --account ${i.channel.slug}`])}

## 手順
1. **リサーチ**: 上の「お題」と「リサーチ手法」に従って Web 検索で調べ、話題を1つに決める。出典には**一次情報（公式発表・公式ブログ・リリースノート・ヘルプ）を最低1件**含める。まとめ記事や X の投稿だけで事実を決めない。
2. **登録**: \`trend.json\` を書いて \`trend:add\`。
   \`{ "topic": "...", "angle": "動画の切り口（1文）", "summary": "分かった事実", "sources": [{ "title": "...", "url": "https://..." }] }\`
   - 台本の担当は Web を見ず、この summary と出典だけで台本を書く。台本に使う事実（何が・いつから・誰が使えるか・数字・日付・固有名詞）を、出典どおりに漏れなく書く。
3. **終了**: 選んだ話題と、選んだ理由を**日本語で**短く報告して終える。

${prohibitionSection(i)}`;
}

export const SCRIPT_SYSTEM_PROMPT =
  'あなたは YouTube ショートの台本担当です。渡されたリサーチの結果だけを事実として使い、指示どおりの台本と投稿文を、指定された形の JSON で返します。';

/** 台本の工程（Claude Code / Claude API / Gemini API。JSON を1回返す） */
export function buildScriptPrompt(
  i: JobPromptInput,
  x: { research: ResearchResult | null; knowledge: string[]; sceneTypes: string; exampleLines: string; produce: ProducePromptInput }
): string {
  const research = x.research
    ? `- 話題: ${x.research.topic}
- 切り口: ${x.research.angle}
- 分かった事実: ${x.research.summary}
- 出典:
${sourceList(x.research.sources)}`
    : '（ここに、リサーチの工程で登録した話題・切り口・事実・出典が入ります）';
  const knowledge = x.knowledge.length > 0 ? x.knowledge.map((k) => `- ${k}`).join('\n') : '（まだありません）';
  return `# 動画づくりの依頼（依頼ID: ${i.jobId}）: 台本

チャンネル「${i.channel.name}」のショート動画の台本と投稿文を書いてください。

${channelSection(i)}

## リサーチの結果（事実はこの範囲だけで書く）
${research}

## 構成案: ${i.template.name}
${i.template.body.trim()}

## 過去の実測から得た知見（参考にする）
${knowledge}

${lengthSection(x.produce)}
${produceSection(x.produce)}
## 場面の型定義（scene の各項目はこの型に合わせる）
\`\`\`ts
${x.sceneTypes.trim()}
\`\`\`

## 書き方
- 尺・行数・流れ・場面の選び方は、上の「構成案」に従う。
- 1行目には必ず scene を付ける。scene を付けない行は直前の場面を引き継ぐ。
- 各行: text（読み上げ）、caption（字幕）、emphasis（字幕内で強調する語）、scene、mood（表情）。
${SCRIPT_RULES.map((r) => `- ${r}`).join('\n')}
- title: 動画の題名（画面上部に出る。30字程度まで）。concept: 動画で伝えることを1文で。
- publish.youtube: title（100字以内、末尾に #Shorts）・description（出典 URL を入れる）・tags。publish.tiktok / instagram: caption と tags。publish.x: text（日本語は1字を2と数えて280まで）。

## 行の書き方の実例
\`\`\`json
${x.exampleLines.trim()}
\`\`\`

${prohibitionSection(i)}`;
}

// 尺の目安。台本の担当は音声の長さが分からないので、読み上げの字数から尺を見積もらせる
function lengthSection(p: ProducePromptInput): string {
  const rate = (speed: number) => Math.round(p.charsPerSecAt1x * speed * 10) / 10;
  const how = p.request.speed
    ? `話す速さは ${p.request.speed} 倍で、読み上げ（各行の text）は1秒あたり約 ${rate(p.request.speed)} 字になる（場面の切り替えの間を含む）。`
    : `読み上げ（各行の text）は1秒あたり約「${p.charsPerSecAt1x} × 話す速さ」字になる（例: 1.15倍で約 ${rate(1.15)} 字。場面の切り替えの間を含む）。`;
  return `## 尺の目安
- ${how}
- 構成案の尺に収まるよう、text の合計の字数を決める。尺の上限ちょうどではなく、**真ん中あたりを狙う**（例: 30〜50 秒なら 40 秒前後。40 秒なら、1.15 倍で約 ${Math.round(40 * rate(p.request.speed ?? 1.15))} 字）。字幕（caption）は字数に入らない。
`;
}

// 制作の設定のうち「おまかせ」の分を、台本の担当に選ばせる
function produceSection(p: ProducePromptInput): string {
  const items: string[] = [];
  if (p.request.voice === null) items.push(`- produce.voice（声）: 次の id から1つ。話題と視聴者に合う声を選ぶ。迷ったら ${(p.voices.find((v) => v.id.endsWith(':ずんだもん:ノーマル')) ?? p.voices[0])?.id ?? ''}\n${p.voices.map((v) => `  - ${v.id}（${v.label}）`).join('\n')}`);
  if (p.request.speed === null) items.push(`- produce.speed（話す速さ）: ${p.speeds.map(String).join(' / ')} から1つ（文字列で）。情報が多いほど少し速く。迷ったら 1.15`);
  if (p.request.bgm === null) items.push(`- produce.bgm（BGM）: 次の id から1つ（空の文字列は BGM なし）\n${p.bgms.map((b) => `  - "${b.id}"（${b.label}）`).join('\n')}`);
  if (items.length === 0) return '';
  return `## 制作の設定（おまかせの分を選ぶ）
台本と一緒に、次の項目を produce に入れて返してください。

${items.join('\n')}
`;
}

/** 点検の工程（Claude Code）。確認用の静止画を見て、必要なら直して作り直し、報告して終わる */
export function buildCheckPrompt(
  i: JobPromptInput,
  x: { projectId: string; research: ResearchResult | null; researchReport: string; durationSec: number | null }
): string {
  const preview = `${i.repoDir}/data/projects/${x.projectId}/work/preview.png`;
  return `# 動画づくりの依頼（依頼ID: ${i.jobId}）: 点検

あなたは YouTube ショートのチャンネル「${i.channel.name}」の点検担当です。前の工程で台本を書き、動画を作りました。確認用の静止画と動画の長さを見て、必要なら直して作り直し、承認する人への報告で終えてください。**承認の手前で止まって**ください。承認・投稿・公開は人が行います。

${JAPANESE}

## この動画
- 企画ID: ${x.projectId}
- 話題: ${x.research?.topic ?? '（リサーチの話題）'}
- 出典:
${x.research ? sourceList(x.research.sources) : '（リサーチの出典）'}
- 台本: 作業フォルダの \`${i.workDir}/project.json\`（直すときはこれを書き換えて \`project:update\` に渡す）
- 確認用の静止画: \`${preview}\`
- 動画の長さ: ${x.durationSec === null ? '（制作のあとに入ります）' : `${x.durationSec} 秒`}

## 構成案: ${i.template.name}（尺はここに従う）
${i.template.body.trim()}

## リサーチ担当の報告
${x.researchReport.trim() || '（なし）'}

${commandSection(i, [`project:update ${x.projectId} <file.json>`, `produce ${x.projectId}`])}

## 手順
1. **点検**: 確認用の静止画を Read で見て、字幕のはみ出し・不自然な改行・誤字・場面の崩れを確認する。必要なら project.json も Read する。**動画の長さが上の構成案の尺から外れていないか**も確かめる。
2. **直す**: 問題があれば project.json を直して \`project:update\` → \`produce\`（数分かかる）→ 静止画と、produce が表示する動画の長さを見直す（最大2回）。尺が長すぎるときは、読み上げ（text）を削って短くする（読み上げはおよそ1秒あたり6字）。直すときも次を守る。
${SCRIPT_RULES.map((r) => `   - ${r}`).join('\n')}
3. **終了**: 企画ID・選んだ話題と理由・出典・承認する人に確認してほしい点を、**日本語で**短く報告して終える。

${prohibitionSection(i)}`;
}
