// Single entry point for all AI features. The rest of the app imports ONLY this
// file — it never touches a provider directly. Switch providers via
// VITE_AI_PROVIDER without changing any feature code.
import type { AiProvider, AiResult } from './types';
import { MockAiProvider } from './mockProvider';
// import { ClaudeAiProvider } from './claudeProvider'; // add in phase 4
// import { OpenAiProvider } from './openaiProvider';

function resolveProvider(): AiProvider {
  const choice = (import.meta.env.VITE_AI_PROVIDER as string) ?? 'mock';
  switch (choice) {
    // case 'claude': return new ClaudeAiProvider();
    // case 'openai': return new OpenAiProvider();
    case 'mock':
    default:
      return new MockAiProvider();
  }
}

const provider = resolveProvider();

export const aiService = {
  providerName: provider.name,

  okrQualityCheck: (input: {
    objective: unknown; keyResults: unknown[]; kpis: unknown[]; actionPlans: unknown[];
  }): Promise<AiResult> => provider.run({ feature: 'okr_quality', input }),

  weeklyReview: (input: {
    completed: unknown[]; delayed: unknown[]; atRiskKr: unknown[]; membersWithoutCfr: unknown[];
  }): Promise<AiResult> => provider.run({ feature: 'weekly_review', input }),

  riskDetection: (input: { items: unknown[] }): Promise<AiResult> =>
    provider.run({ feature: 'risk_detection', input }),

  nextAction: (input: { items: unknown[] }): Promise<AiResult> =>
    provider.run({ feature: 'next_action', input }),

  executiveSummary: (input: unknown): Promise<AiResult> =>
    provider.run({ feature: 'executive_summary', input }),

  teamBriefing: (input: unknown): Promise<AiResult> =>
    provider.run({ feature: 'team_briefing', input }),

  performanceCoach: (input: { items: unknown[] }): Promise<AiResult> =>
    provider.run({ feature: 'performance_coach', input }),

  meetingSummary: (input: { decisions: string[] }): Promise<AiResult> =>
    provider.run({ feature: 'meeting_summary', input }),
};

export type { AiResult } from './types';
