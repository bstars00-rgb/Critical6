// Rule-based mock provider. No API key needed — produces realistic, data-driven
// AiResult so the product is fully usable in MVP. Same interface as the future
// Claude/OpenAI providers, so swapping is a one-line change in aiService.ts.
import type { AiProvider, AiRequest, AiResult, AiAction, AiRiskLevel } from './types';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const worst = (a: AiRiskLevel, b: AiRiskLevel): AiRiskLevel => {
  const order: AiRiskLevel[] = ['low', 'medium', 'high', 'critical'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
};
const daysUntil = (d?: string | null) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null;

function okrQuality(input: any): AiResult {
  const o = input.objective ?? {};
  const krs: any[] = input.keyResults ?? [];
  const kpis: any[] = input.kpis ?? [];
  const actions: any[] = input.actionPlans ?? [];

  const clarity = clamp(40 + (o.description ? 25 : 0) + (o.title?.length > 8 ? 20 : 0) + (o.due_date ? 15 : 0));
  const measurability = clamp(
    krs.length === 0 ? 10
      : (krs.filter((k) => k.target_value != null).length / krs.length) * 100,
  );
  const alignment = clamp(
    (o.parent_objective_id ? 50 : 10) + (kpis.length > 0 ? 50 : 0),
  );
  const withOwnerDue = actions.filter((a) => a.owner_id && a.due_date).length;
  const execution = clamp(
    actions.length === 0 ? 15 : 30 + (withOwnerDue / actions.length) * 70,
  );
  const tooMany = krs.length > 5;
  const risk = clamp(100 - (tooMany ? 40 : 0) - (measurability < 50 ? 30 : 0) - (kpis.length ? 0 : 20));

  const findings: string[] = [];
  if (measurability < 60) findings.push(`KR ${krs.length}개 중 측정 가능한 목표값이 부족합니다.`);
  if (kpis.length === 0) findings.push('연결된 KPI가 없어 성과를 수치로 추적할 수 없습니다.');
  if (!o.parent_objective_id && o.level !== 'company') findings.push('상위(회사) 목표와 연결되어 있지 않습니다.');
  if (actions.length === 0) findings.push('Action Plan이 없어 실행 경로가 비어 있습니다.');
  if (tooMany) findings.push(`KR이 ${krs.length}개로 너무 많습니다. 3~5개로 집중하세요.`);
  if (findings.length === 0) findings.push('구조는 양호합니다. 진행률 업데이트 주기만 유지하세요.');

  const actionsOut: AiAction[] = [];
  if (measurability < 60) actionsOut.push({ action: '각 KR에 target_value/unit를 채워 측정 가능하게 만들기' });
  if (kpis.length === 0) actionsOut.push({ action: '핵심 KR 1개에 KPI를 연결하고 데이터 소스를 지정' });
  if (actions.length === 0) actionsOut.push({ action: '가장 위험한 KR에 Action Plan 2개를 추가' });

  const avg = clamp((clarity + measurability + alignment + execution) / 4);
  return {
    summary: `OKR 품질 종합 ${avg}/100 — ${findings[0]}`,
    risk_level: risk < 40 ? 'high' : risk < 70 ? 'medium' : 'low',
    key_findings: findings,
    recommended_actions: actionsOut.slice(0, 3),
    manager_attention_required: risk < 50,
    confidence_score: clamp(60 + alignment / 5),
    execution_score: execution,
    scores: {
      clarity_score: clarity,
      measurability_score: measurability,
      alignment_score: alignment,
      execution_score: execution,
      risk_score: risk,
    },
  };
}

function riskOrNextAction(input: any, feature: string): AiResult {
  const items: any[] = input.items ?? input.keyResults ?? [];
  const findings: string[] = [];
  let level: AiRiskLevel = 'low';
  const actions: AiAction[] = [];

  for (const it of items) {
    const dleft = daysUntil(it.due_date);
    const prog = Number(it.progress ?? 0);
    if (dleft != null && dleft <= 10 && prog < 50) {
      findings.push(`"${it.title}" 진행률 ${prog}%인데 마감 ${dleft}일 남음.`);
      level = worst(level, dleft <= 3 ? 'critical' : 'high');
    }
    if (it.blocker) {
      findings.push(`"${it.title}" blocker: ${it.blocker}`);
      level = worst(level, 'high');
    }
  }
  const delayed = items.filter((i) => i.status === 'delayed' || i.status === 'at_risk');
  if (delayed.length >= 2) {
    actions.push({ action: `신규 작업 추가 전, 지연된 ${delayed.length}개 중 2개를 먼저 완료하세요.` });
  }
  if (findings.length === 0) findings.push('마감 임박 위험 항목이 없습니다. 현재 페이스 유지.');
  if (actions.length === 0 && items[0]) actions.push({ action: `"${items[0].title}"의 다음 단계를 오늘 1건 진행` });

  return {
    summary: feature === 'next_action'
      ? (actions[0]?.action ?? '오늘의 우선 실행을 지정하세요.')
      : `위험 신호 ${findings.length}건 감지 (${level}).`,
    risk_level: level,
    key_findings: findings.slice(0, 5),
    recommended_actions: actions.slice(0, 3),
    manager_attention_required: level === 'high' || level === 'critical',
    confidence_score: 70,
    execution_score: clamp(60 - delayed.length * 8),
  };
}

function weeklyOrBriefing(input: any): AiResult {
  const completed: any[] = input.completed ?? [];
  const delayed: any[] = input.delayed ?? [];
  const atRiskKr: any[] = input.atRiskKr ?? [];
  const noCfr: any[] = input.membersWithoutCfr ?? [];

  const findings = [
    `완료 ${completed.length}건 / 지연 ${delayed.length}건.`,
    `위험 KR ${atRiskKr.length}건.`,
    noCfr.length ? `CFR 미작성: ${noCfr.map((m) => m.full_name ?? m).join(', ')}` : 'CFR 전원 제출.',
  ];
  const level: AiRiskLevel = atRiskKr.length >= 3 ? 'high' : delayed.length ? 'medium' : 'low';
  const actions: AiAction[] = [];
  if (atRiskKr[0]) actions.push({ action: `위험 KR "${atRiskKr[0].title}" 담당자와 1:1 점검` });
  if (noCfr.length) actions.push({ action: `CFR 미작성자 ${noCfr.length}명에게 리마인드` });
  if (delayed[0]) actions.push({ action: `지연 작업 "${delayed[0].title}" 마감 재협의` });

  return {
    summary: `이번 주: 완료 ${completed.length} · 지연 ${delayed.length} · 위험 KR ${atRiskKr.length}.`,
    risk_level: level,
    key_findings: findings,
    recommended_actions: actions.slice(0, 3),
    manager_attention_required: level !== 'low',
    confidence_score: 75,
    execution_score: clamp(70 - delayed.length * 5 - atRiskKr.length * 5),
  };
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  async run<T>(req: AiRequest<T>): Promise<AiResult> {
    const input = req.input as any;
    switch (req.feature) {
      case 'okr_quality': return okrQuality(input);
      case 'risk_detection': return riskOrNextAction(input, 'risk_detection');
      case 'next_action': return riskOrNextAction(input, 'next_action');
      case 'weekly_review':
      case 'team_briefing': return weeklyOrBriefing(input);
      case 'executive_summary': return weeklyOrBriefing(input);
      case 'performance_coach': return riskOrNextAction(input, 'next_action');
      case 'meeting_summary':
        return {
          summary: '회의 결정사항을 Action Plan으로 변환했습니다.',
          risk_level: 'low',
          key_findings: (input.decisions ?? []).slice(0, 5),
          recommended_actions: (input.decisions ?? []).slice(0, 3).map((d: string) => ({ action: d })),
          manager_attention_required: false,
          confidence_score: 65,
          execution_score: 60,
        };
      default:
        return {
          summary: '분석할 데이터가 부족합니다.',
          risk_level: 'low', key_findings: [], recommended_actions: [],
          manager_attention_required: false, confidence_score: 0, execution_score: 0,
        };
    }
  }
}
