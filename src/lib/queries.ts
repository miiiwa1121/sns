import { prisma } from '@/lib/prisma';
import { isActionableNow, nextAction, NextAction } from '@/lib/workflow';

const projectInclude = {
  account: true,
  shortClips: true,
  publishLogs: true,
  analytics: true,
  trendResearch: true,
} as const;

export type ProjectWithAll = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export async function loadProject(id: string) {
  return prisma.project.findUnique({ where: { id }, include: projectInclude });
}

export async function loadProjects(accountId: string) {
  const projects = await prisma.project.findMany({
    where: { accountId },
    include: projectInclude,
    orderBy: { createdAt: 'desc' },
  });
  return projects.map((p) => ({ project: p, next: nextAction(p) }));
}

export interface Task {
  project: ProjectWithAll;
  next: NextAction;
}

/**
 * 全チャンネル横断で、ユーザーが対応する企画を集める。
 * now: 今すぐ対応 / later: 期限待ち（計測など） / agent: エージェントの作業待ち
 */
export async function loadYourTurn(): Promise<{ now: Task[]; later: Task[]; agent: Task[] }> {
  const projects = await prisma.project.findMany({
    where: { account: { isActive: true } },
    include: projectInclude,
    orderBy: { updatedAt: 'desc' },
  });
  const tasks = projects.map((p) => ({ project: p, next: nextAction(p) }));
  return {
    now: tasks.filter((t) => isActionableNow(t.next)),
    later: tasks.filter((t) => t.next.owner === 'you' && !isActionableNow(t.next)),
    agent: tasks.filter((t) => t.next.owner === 'agent'),
  };
}
