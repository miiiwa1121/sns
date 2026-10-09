import { prisma } from '@/lib/prisma';
import { diagnosePerformance, DiagnosisResult, MetricsInput } from './performanceDiagnosis';

export interface PerformanceAnalysisInput {
  accountId: string;
  projectId: string;
  videoTitle: string;
  metrics: MetricsInput;
}

export class CriticAgent {
  /**
   * 実測アナリティクスから、計算で言える事実だけを診断・知見化する
   */
  static analyzePerformance(input: PerformanceAnalysisInput): DiagnosisResult {
    return diagnosePerformance(input.videoTitle, input.metrics);
  }

  /**
   * 分析知見を SQLite DB の AgentKnowledge テーブルに蓄積
   */
  static async persistKnowledge(accountId: string, knowledge: NonNullable<DiagnosisResult['actionableKnowledge']>) {
    return await prisma.agentKnowledge.create({
      data: {
        accountId,
        category: knowledge.category,
        ruleText: knowledge.ruleText,
        confidenceScore: knowledge.confidenceScore,
        appliedCount: 0,
      },
    });
  }
}
