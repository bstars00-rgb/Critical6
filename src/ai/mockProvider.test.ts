import { describe, it, expect } from 'vitest';
import { MockAiProvider } from './mockProvider';
import { OUTPUT_CONTRACT, PROMPTS } from './prompts';

const ai = new MockAiProvider();
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('MockAiProvider — okr_quality', () => {
  it('returns the five required sub-scores', async () => {
    const r = await ai.run({
      feature: 'okr_quality',
      input: {
        objective: { title: 'SEA Channel Growth', description: 'x', due_date: future(90), level: 'team', parent_objective_id: 'p1' },
        keyResults: [{ target_value: 1000, current_value: 640 }],
        kpis: [{ id: 'k1' }],
        actionPlans: [{ owner_id: 'u1', due_date: future(5) }],
      },
    });
    for (const k of ['clarity_score', 'measurability_score', 'alignment_score', 'execution_score', 'risk_score']) {
      expect(r.scores).toHaveProperty(k);
      expect(r.scores![k]).toBeGreaterThanOrEqual(0);
      expect(r.scores![k]).toBeLessThanOrEqual(100);
    }
  });

  it('penalizes measurability when KRs lack target values', async () => {
    const r = await ai.run({
      feature: 'okr_quality',
      input: { objective: { level: 'team' }, keyResults: [{ target_value: null }, { target_value: null }], kpis: [], actionPlans: [] },
    });
    expect(r.scores!.measurability_score).toBeLessThan(60);
    expect(r.key_findings.join(' ')).toMatch(/측정|KPI/);
  });

  it('flags too many KRs (>5)', async () => {
    const krs = Array.from({ length: 7 }, () => ({ target_value: 100 }));
    const r = await ai.run({ feature: 'okr_quality', input: { objective: { level: 'team' }, keyResults: krs, kpis: [], actionPlans: [] } });
    expect(r.key_findings.some((f) => /너무 많/.test(f))).toBe(true);
  });
});

describe('MockAiProvider — risk & next action', () => {
  it('raises high/critical risk for imminent deadline + low progress', async () => {
    const r = await ai.run({
      feature: 'risk_detection',
      input: { items: [{ title: 'KR3', due_date: future(2), progress: 20, status: 'at_risk' }] },
    });
    expect(['high', 'critical']).toContain(r.risk_level);
    expect(r.manager_attention_required).toBe(true);
  });

  it('recommends finishing delayed work before adding new', async () => {
    const r = await ai.run({
      feature: 'next_action',
      input: { items: [
        { title: 'A', status: 'delayed', progress: 30 },
        { title: 'B', status: 'at_risk', progress: 10 },
      ] },
    });
    expect(r.recommended_actions.length).toBeGreaterThan(0);
    expect(r.recommended_actions[0].action).toMatch(/지연/);
  });

  it('stays calm when nothing is at risk', async () => {
    const r = await ai.run({ feature: 'risk_detection', input: { items: [{ title: 'ok', due_date: future(60), progress: 90, status: 'in_progress' }] } });
    expect(r.risk_level).toBe('low');
  });
});

describe('MockAiProvider — meeting summary', () => {
  it('maps decisions into recommended actions', async () => {
    const r = await ai.run({ feature: 'meeting_summary', input: { decisions: ['배포 일정 확정', 'QA 담당 지정'] } });
    expect(r.recommended_actions.map((a) => a.action)).toContain('배포 일정 확정');
  });
});

describe('always returns the normalized contract shape', () => {
  it('has all required fields for every feature', async () => {
    const features = ['okr_quality', 'weekly_review', 'risk_detection', 'next_action', 'executive_summary', 'team_briefing', 'performance_coach', 'meeting_summary'] as const;
    for (const f of features) {
      const r = await ai.run({ feature: f, input: { items: [], decisions: [] } });
      expect(r).toHaveProperty('summary');
      expect(['low', 'medium', 'high', 'critical']).toContain(r.risk_level);
      expect(Array.isArray(r.key_findings)).toBe(true);
      expect(Array.isArray(r.recommended_actions)).toBe(true);
      expect(typeof r.manager_attention_required).toBe('boolean');
      expect(r.recommended_actions.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('prompt templates', () => {
  it('every feature prompt embeds the JSON output contract', () => {
    for (const key of Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]) {
      expect(PROMPTS[key]).toContain(OUTPUT_CONTRACT);
    }
  });
});
