import fs from 'fs';
import path from 'path';
import { buildCheckPrompt, buildResearchPrompt, buildScriptPrompt, type JobPromptInput } from '../../agent/job-prompt';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import { defaultTemplateFor } from '@/lib/services/templateService';
import { defaultResearchMethodFor, listProhibitions } from '@/lib/services/researchMethodService';
import { CHARS_PER_SEC_AT_1X, SPEED_OPTIONS, bgmOptions, voiceOptions } from '@/lib/services/produceSettings';

type Part = { name: string; body: string };
type Channel = JobPromptInput['channel'] & { id: string; defaultTemplateId: string | null; defaultResearchMethodId: string | null };

/**
 * 画面に出す「工程ごとに AI に渡す指示書」の見本（お題おまかせ・パスなどは見本の値）。
 * 指定しなかった部分は、そのアカウントの既定の構成案・リサーチ手法と、最初から選んだ状態の禁止事項で埋める。
 * 台本の指示書のリサーチの結果は、依頼のたびにリサーチの工程で決まるので空欄のまま
 */
export async function previewJobPrompts(channel: Channel, parts: { template?: Part; researchMethod?: Part } = {}) {
  const [template, researchMethod, prohibitions, knowledge] = await Promise.all([
    parts.template ?? defaultTemplateFor(channel),
    parts.researchMethod ?? defaultResearchMethodFor(channel),
    listProhibitions(),
    prisma.agentKnowledge.findMany({ where: { accountId: channel.id }, orderBy: { confidenceScore: 'desc' }, take: 10 }),
  ]);
  const input: JobPromptInput = {
    jobId: '(依頼ID)',
    repoDir: '(リポジトリ)',
    workDir: '(作業フォルダ)',
    theme: null,
    channel,
    template,
    researchMethod,
    prohibitions: prohibitions.filter((p) => p.isDefault).map((p) => p.text),
  };
  const root = process.cwd();
  const example = safeJson<{ lines?: unknown[] }>(fs.readFileSync(path.join(root, 'agent/examples/project.example.json'), 'utf-8'), {});
  return {
    research: buildResearchPrompt(input),
    script: buildScriptPrompt(input, {
      research: null,
      knowledge: knowledge.map((k) => k.ruleText),
      sceneTypes: fs.readFileSync(path.join(root, 'remotion/types.ts'), 'utf-8'),
      exampleLines: JSON.stringify((example.lines ?? []).slice(0, 3), null, 2),
      // 見本は「作成する」の既定（制作はすべておまかせ）
      produce: {
        request: { voice: null, speed: null, bgm: bgmOptions().length > 1 ? null : '' },
        voices: voiceOptions(),
        speeds: SPEED_OPTIONS,
        bgms: bgmOptions().map((b) => ({ ...b, id: b.id || 'none' })),
        charsPerSecAt1x: CHARS_PER_SEC_AT_1X,
      },
    }),
    check: buildCheckPrompt(input, { projectId: '(企画ID)', research: null, researchReport: '（ここに、リサーチ担当の報告が入ります）', durationSec: null }),
  };
}
