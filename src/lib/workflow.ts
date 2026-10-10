// 企画（プロジェクト）が今どの工程にいて、次に誰が何をするかを決める。
// 管理画面とエージェント CLI（status）で同じ判定を使う。

export const STEPS = ['台本', '制作', '承認', '配信', '計測・分析'] as const;

export type Owner = 'you' | 'agent' | 'done';

export interface NextAction {
  step: number; // STEPS の添字（今いる工程）
  owner: Owner;
  label: string; // 次にやること
  dueAt?: Date; // この日時以降にやる（計測など）
}

export interface WorkflowInput {
  stage: string;
  shortClips: { scriptJson: string | null; renderedFilePath: string | null; readyToPublish: boolean }[];
  publishLogs: { status: string; publishedAt: Date | null }[];
  analytics: unknown[];
}

// 公開してから実測値を入れるまでの待ち時間（再生数がある程度たまるまで）
const MEASURE_AFTER_MS = 24 * 60 * 60 * 1000;

export function nextAction(p: WorkflowInput): NextAction {
  const clip = p.shortClips[0];
  if (!clip?.scriptJson) return { step: 0, owner: 'agent', label: '台本を作る' };
  if (!clip.renderedFilePath) return { step: 1, owner: 'agent', label: '動画を作る' };
  if (!clip.readyToPublish) return { step: 2, owner: 'you', label: '動画を確認して承認する' };

  const published = p.publishLogs.filter((l) => l.status === 'published');
  if (published.length === 0) return { step: 3, owner: 'you', label: 'SNS に投稿する' };

  if (p.analytics.length === 0) {
    const first = Math.min(...published.map((l) => l.publishedAt?.getTime() ?? Date.now()));
    return { step: 4, owner: 'you', label: '再生数などの数字を入れる', dueAt: new Date(first + MEASURE_AFTER_MS) };
  }
  if (p.stage !== 'analyzed') return { step: 4, owner: 'you', label: '分析する' };
  return { step: 4, owner: 'done', label: '完了' };
}

// 今すぐ対応が必要か（期限前の計測は「まだ」）
export function isActionableNow(a: NextAction, now = new Date()): boolean {
  return a.owner === 'you' && (!a.dueAt || a.dueAt <= now);
}
