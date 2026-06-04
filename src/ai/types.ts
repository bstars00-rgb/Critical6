// Shared AI contract. Every AI feature returns this normalized shape so the UI
// renders identically regardless of which provider (mock/claude/openai) answered.

export type AiRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AiResult {
  summary: string;
  risk_level: AiRiskLevel;
  key_findings: string[];
  recommended_actions: AiAction[];
  manager_attention_required: boolean;
  confidence_score: number; // 0..100
  execution_score: number;  // 0..100
  // Feature-specific extras (e.g. OKR quality sub-scores) ride along here.
  scores?: Record<string, number>;
  meta?: Record<string, unknown>;
}

export interface AiAction {
  action: string;
  owner?: string;
  due_date?: string;        // ISO date recommendation
}

export type AiFeature =
  | 'okr_quality'
  | 'weekly_review'
  | 'risk_detection'
  | 'next_action'
  | 'executive_summary'
  | 'team_briefing'
  | 'performance_coach'
  | 'meeting_summary';

export interface AiRequest<T = unknown> {
  feature: AiFeature;
  input: T;                 // structured context for the feature
}

// A provider just turns a request into a normalized AiResult.
export interface AiProvider {
  readonly name: string;
  run<T>(req: AiRequest<T>): Promise<AiResult>;
}
