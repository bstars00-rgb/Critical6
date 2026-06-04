// In-memory demo dataset mirroring supabase/seed.sql (same UUIDs so relations
// line up). Used by the mock client when no Supabase backend is configured —
// powers the GitHub Pages prototype. Writes persist for the session only.
/* eslint-disable @typescript-eslint/no-explicit-any */

const iso = (d: string) => new Date(d + 'T09:00:00Z').toISOString();
const audit = (by = '11111111-1111-1111-1111-111111111111') => ({
  created_at: iso('2026-05-01'), updated_at: iso('2026-05-01'), created_by: by, updated_by: by,
});

const U = {
  admin: '11111111-1111-1111-1111-111111111111',
  exec: '22222222-2222-2222-2222-222222222222',
  leader: '33333333-3333-3333-3333-333333333333',
  jihoon: '44444444-4444-4444-4444-444444444444',
  minseo: '55555555-5555-5555-5555-555555555555',
};
const T = {
  gst: 'a0000001-0000-0000-0000-000000000001', ota: 'a0000002-0000-0000-0000-000000000002',
  sales: 'a0000003-0000-0000-0000-000000000003', jpkr: 'a0000004-0000-0000-0000-000000000004',
};
const O = {
  c1: 'c0000001-0000-0000-0000-000000000001', c2: 'c0000002-0000-0000-0000-000000000002',
  c3: 'c0000003-0000-0000-0000-000000000003',
  t1: '70000001-0000-0000-0000-000000000001', t2: '70000002-0000-0000-0000-000000000002',
  t3: '70000003-0000-0000-0000-000000000003', t4: '70000004-0000-0000-0000-000000000004',
};
const KR = {
  k1: '40000001-0000-0000-0000-000000000001', k2: '40000002-0000-0000-0000-000000000002',
  k3: '40000003-0000-0000-0000-000000000003', k4: '40000004-0000-0000-0000-000000000004',
  k5: '40000005-0000-0000-0000-000000000005',
};
const C6 = {
  a: 'c6000001-0000-0000-0000-000000000001', b: 'c6000002-0000-0000-0000-000000000002',
  c: 'c6000003-0000-0000-0000-000000000003', d: 'c6000004-0000-0000-0000-000000000004',
  e: 'c6000005-0000-0000-0000-000000000005', f: 'c6000006-0000-0000-0000-000000000006',
};

export type DemoDb = Record<string, any[]>;

export function buildDemoDb(): DemoDb {
  const kpis = [
    kpi('Active Channel Count', KR.k1, O.t1, T.gst, U.leader, 'active_channel_count', 'channels', 1000, 640, 600, 'database', 'active_channels'),
    kpi('Monthly Booking Count', null, O.t1, T.gst, U.jihoon, 'booking_count', 'bookings', 50000, 38000, 35000, 'database', 'monthly_bookings'),
    kpi('Monthly Revenue', KR.k2, O.t3, T.sales, U.leader, 'revenue', 'kUSD', 7000, 4200, 3800, 'database', 'mrr_sea'),
    kpi('API Success Rate', KR.k3, O.t2, T.ota, U.minseo, 'api_success_rate', '%', 99.5, 98.7, 99.1, 'api', 'success_rate_24h'),
    kpi('Mapping Completion Rate', null, O.t2, T.ota, U.minseo, 'mapping_completion_rate', '%', 100, 82, 78, 'database', 'mapping_rate'),
    kpi('CRM Pipeline Value', null, O.t3, T.sales, U.leader, 'crm_pipeline_value', 'kUSD', 10000, 6200, 5500, 'crm', 'pipeline_value'),
    kpi('CFR Completion Rate', null, null, null, U.admin, 'automation_rate', '%', 100, 70, 65, 'manual', 'cfr_rate'),
    kpi('Critical 6 Completion Rate', null, null, null, U.admin, 'automation_rate', '%', 100, 55, 50, 'manual', 'c6_rate'),
  ];

  const kpi_history = kpis.flatMap((k) => {
    const prev = k.previous_value;
    if (prev == null) return [];
    return [1, 2, 3, 4].map((g) => ({
      id: `${k.id}:h${g}`, kpi_id: k.id,
      value: Math.round((prev + (k.current_value - prev) * g / 4) * 100) / 100,
      recorded_at: iso(`2026-0${5 + (g >= 4 ? 1 : 0)}-${g >= 4 ? '01' : (7 + g * 7).toString().padStart(2, '0')}`),
      source: 'manual', data_source_id: null, sync_log_id: null, note: null, ...audit(),
    }));
  });

  return {
    users: [
      user(U.admin, 'admin@company.com', '시스템 관리자', 'admin', 'Platform Admin'),
      user(U.exec, 'exec@company.com', '김대표', 'executive', 'CEO'),
      user(U.leader, 'leader@company.com', '이채널', 'team_leader', 'GST Channel Lead'),
      user(U.jihoon, 'jihoon@company.com', '박지훈', 'member', 'Channel Manager'),
      user(U.minseo, 'minseo@company.com', '최민서', 'member', 'API Engineer'),
    ],
    teams: [
      team(T.gst, 'GST Channel', U.leader), team(T.ota, 'OTA/API', U.minseo),
      team(T.sales, 'Sales CRM', U.leader), team(T.jpkr, 'Japan/Korea', U.jihoon),
    ],
    team_members: [
      tm(T.gst, U.leader, 'leader'), tm(T.gst, U.jihoon, 'member'),
      tm(T.ota, U.minseo, 'leader'), tm(T.sales, U.leader, 'leader'), tm(T.jpkr, U.jihoon, 'leader'),
    ],
    team_access: [],
    objectives: [
      obj(O.c1, '2026 Southeast Asia B2B Channel Growth', 'company', U.exec, null, null, 'in_progress', 'critical', 72),
      obj(O.c2, '2026 Revenue Growth', 'company', U.exec, null, null, 'in_progress', 'critical', 61),
      obj(O.c3, '2026 AI-based Work Efficiency Improvement', 'company', U.exec, null, null, 'in_progress', 'important', 30),
      obj(O.t1, 'GST Channel Expansion', 'team', U.leader, T.gst, O.c1, 'in_progress', 'urgent', 64),
      obj(O.t2, 'OTA/API Stability Improvement', 'team', U.minseo, T.ota, O.c1, 'at_risk', 'important', 99),
      obj(O.t3, 'Sales CRM & Pipeline Management', 'team', U.leader, T.sales, O.c2, 'in_progress', 'important', 60),
      obj(O.t4, 'Japan/Korea Client Expansion', 'team', U.jihoon, T.jpkr, O.c2, 'in_progress', 'medium', 62),
    ],
    objective_owners: [],
    key_results: [
      kr(KR.k1, O.t1, 'KR1 Active Channel 1000', 'active_channel_count', 1000, 640, 'channels', U.leader, 'in_progress', 'urgent', '2026-09-30'),
      kr(KR.k2, O.t3, 'KR2 Revenue Growth 7000', 'revenue', 7000, 4200, 'kUSD', U.leader, 'in_progress', 'critical', '2026-12-31'),
      kr(KR.k3, O.t2, 'KR3 API Stability 99.5%', 'api_success_rate', 99.5, 98.7, '%', U.minseo, 'at_risk', 'important', '2026-06-15'),
      kr(KR.k4, O.t4, 'KR4 Customer Expansion 65%', 'new_client_count', 65, 40, '%', U.jihoon, 'in_progress', 'medium', '2026-12-31'),
      kr(KR.k5, O.c3, 'KR5 AI Work Efficiency Improvement', 'automation_rate', 100, 30, '%', U.admin, 'in_progress', 'important', '2026-12-31'),
    ],
    key_result_owners: [],
    data_sources: [], data_sync_logs: [],
    kpis, kpi_history,
    critical_six: [
      c6(C6.a, '오늘 Ctrip Rate Plan 제한 이슈 정리', KR.k1, O.t1, U.leader, T.gst, 'in_progress', 'critical', '영향 호텔 리스트 확정 + 대응안 공유', '2026-06-06', true, true),
      c6(C6.b, 'GGT SLA 최종 피드백 확인', KR.k2, O.t3, U.leader, T.sales, 'in_progress', 'urgent', 'SLA 문서 사인오프', '2026-06-07', true, true),
      c6(C6.c, 'Agoda 계약수정합의서 재확인', KR.k1, O.t1, U.leader, T.gst, 'delayed', 'important', '법무 검토 완료', '2026-06-02', false, true),
      c6(C6.d, 'Sales CRM 구조 초안 작성', KR.k2, O.t3, U.leader, T.sales, 'in_progress', 'important', 'ERD + 화면 흐름 초안', '2026-06-10', false, true),
      c6(C6.e, 'AI Challenge 팀별 과제 정리', KR.k5, O.c3, U.leader, null, 'not_started', 'medium', '팀별 과제 1개씩 확정', '2026-06-12', false, true),
      c6(C6.f, 'Traveloka 정산 법인 확인', KR.k1, O.t1, U.leader, T.gst, 'at_risk', 'urgent', '정산 법인/통화 확정', '2026-06-08', false, true),
    ],
    action_plans: [
      ap('Ctrip affected hotel list 확인', KR.k1, C6.a, U.jihoon, T.gst, 'in_progress', 'critical', '2026-06-05'),
      ap('Agoda Contract Amendment 확인', KR.k1, C6.c, U.leader, T.gst, 'delayed', 'important', '2026-06-02'),
      ap('Traveloka Settlement Entity 확인', KR.k1, C6.f, U.jihoon, T.gst, 'at_risk', 'urgent', '2026-06-08'),
      ap('GGT SLA 마무리', KR.k2, C6.b, U.leader, T.sales, 'in_progress', 'urgent', '2026-06-07'),
      ap('Sales CRM 구축', null, C6.d, U.leader, T.sales, 'in_progress', 'important', '2026-07-01'),
      ap('AI Challenge 진행', KR.k5, C6.e, U.admin, null, 'not_started', 'medium', '2026-06-20'),
      ap('Japan/Korea Client Expansion', KR.k4, null, U.jihoon, T.jpkr, 'in_progress', 'medium', '2026-08-01'),
      ap('ITB India 준비', null, null, U.jihoon, T.jpkr, 'not_started', 'low', '2026-07-15'),
      ap('Mapping Completion Rate 개선', KR.k3, null, U.minseo, T.ota, 'in_progress', 'important', '2026-06-30'),
      ap('API Error Rate 점검', KR.k3, null, U.minseo, T.ota, 'at_risk', 'urgent', '2026-06-11'),
    ],
    action_plan_assignees: [],
    cfr_checkins: [{
      id: 'cfr-seed-1', related_type: 'key_result', related_id: KR.k1, user_id: U.leader, team_id: T.gst,
      week_start_date: '2026-06-01', progress_summary: 'Active Channel 640까지 확대. Ctrip/Traveloka 이슈가 병목.',
      completed_work: 'Agoda 신규 연동 2건', blockers: 'Ctrip Rate Plan 제한, Traveloka 정산 법인 미확정',
      next_week_actions: '대응안 확정 + 법무 검토', support_needed: null, risk_level: 'high', confidence_score: 6,
      manager_feedback: null, manager_user_id: null, recognition_comment: null,
      ai_summary: null, ai_risk_analysis: null, ai_next_action: null, ai_meta: {}, submitted_at: iso('2026-06-02'), ...audit(U.leader),
    }],
    comments: [], attachments: [],
    crm_accounts: [
      acc('Ctrip', 'China', 'SEA/CN', U.leader, 'active', 'strategic', 2500, 1000, KR.k1, '2026-06-05', '2026-05-28'),
      acc('Agoda', 'Singapore', 'SEA', U.leader, 'active', 'strategic', 2000, 800, KR.k1, null, null),
      acc('Traveloka', 'Indonesia', 'SEA', U.jihoon, 'active', 'a', 1500, 600, KR.k1, '2026-06-05', '2026-05-28'),
      acc('Dida', 'China', 'CN', U.jihoon, 'prospect', 'b', 800, null, KR.k1, '2026-06-02', '2026-05-20'),
      acc('Go Global Travel', 'UK', 'EU', U.leader, 'active', 'a', 1200, 480, KR.k2, null, null),
      acc('Hotelpass', 'Korea', 'KR', U.jihoon, 'active', 'b', 600, 240, KR.k4, null, null),
      acc('MyRealTrip', 'Korea', 'KR', U.jihoon, 'prospect', 'b', 500, null, KR.k4, '2026-06-02', '2026-05-20'),
      acc('HanaTour', 'Korea', 'KR', U.jihoon, 'prospect', 'c', 400, null, KR.k4, null, null),
    ],
    crm_opportunities: [
      opp('Vietnam Hotel Campaign', 'Traveloka', U.jihoon, 'negotiation', 1500, 60, '2026-07-15', KR.k1, 'rate plan 최종 확정', 'medium'),
      opp('Ctrip Rate Plan Renewal', 'Ctrip', U.leader, 'contract', 2500, 80, '2026-06-30', KR.k1, '계약서 사인', 'high'),
      opp('Agoda SEA Expansion', 'Agoda', U.leader, 'proposal', 2000, 50, '2026-08-01', KR.k1, '제안서 발송', 'medium'),
      opp('Dida China Onboarding', 'Dida', U.jihoon, 'meeting', 800, 30, '2026-09-01', KR.k1, '킥오프 미팅 일정', 'low'),
      opp('GGT EU Volume Deal', 'Go Global Travel', U.leader, 'integration', 1200, 70, '2026-07-20', KR.k1, 'API 연동 마무리', 'medium'),
      opp('HanaTour KR Pilot', 'HanaTour', U.jihoon, 'lead', 400, 20, '2026-10-01', KR.k1, '초기 컨택', 'low'),
    ],
    ai_insights: [
      insight('risk_detection', 'key_result', KR.k3, T.ota, 'API Stability 위험', 'KR3 진행률 낮고 마감(6/15) 임박. API Error Rate 점검 작업도 at_risk.', 'high'),
      insight('next_action', 'critical_six', C6.c, T.gst, '지연 작업 우선 처리', 'Agoda 계약수정 작업이 지연 상태입니다. 신규 작업보다 먼저 마감하세요.', 'medium'),
    ],
    activity_logs: [], notifications: [],
  };

  // ---- row builders ----
  function user(id: string, email: string, full_name: string, role: string, title: string) {
    return { id, email, full_name, avatar_url: null, role, title, is_active: true, settings: {}, ...audit() };
  }
  function team(id: string, name: string, lead: string) {
    return { id, name, slug: name.toLowerCase().replace(/\W+/g, '-'), description: null, parent_team_id: null, lead_user_id: lead, is_active: true, ...audit() };
  }
  function tm(team_id: string, user_id: string, team_role: string) {
    return { id: `${team_id}:${user_id}`, team_id, user_id, team_role, ...audit() };
  }
  function obj(id: string, title: string, level: string, owner: string | null, team: string | null, parent: string | null, status: string, priority: string, progress: number) {
    return { id, title, description: null, level, owner_id: owner, team_id: team, parent_objective_id: parent, start_date: null, due_date: null, status, priority, progress, confidence_score: 7, quarter: 2, year: 2026, tags: [], memo: null, ...audit() };
  }
  function kr(id: string, objective_id: string, title: string, metric: string, target: number, current: number, unit: string, owner: string, status: string, priority: string, due: string) {
    return { id, objective_id, title, description: null, metric_type: metric, baseline_value: null, target_value: target, current_value: current, unit, progress: pct(current, target), confidence_score: 7, owner_id: owner, start_date: null, due_date: due, status, priority, ...audit() };
  }
  function kpi(name: string, kr_id: string | null, obj_id: string | null, team: string | null, owner: string, metric: string, unit: string, target: number, current: number, previous: number | null, method: string, ext: string) {
    return { id: `kpi:${ext}`, name, description: null, key_result_id: kr_id, objective_id: obj_id, team_id: team, owner_id: owner, metric_type: metric, unit, target_value: target, current_value: current, previous_value: previous, achievement_rate: pct(current, target), update_frequency: null, update_method: method, data_source_id: null, external_id: ext, last_updated_at: iso('2026-06-01'), status: kpiStatus(current, target), ...audit() };
  }
  function c6(id: string, title: string, kr_id: string, obj_id: string, owner: string, team: string | null, status: string, priority: string, criteria: string, due: string, today: boolean, weekly: boolean) {
    return { id, title, description: null, objective_id: obj_id, key_result_id: kr_id, kpi_id: null, owner_id: owner, team_id: team, start_date: null, due_date: due, status, priority, impact_score: 8, confidence_score: 6, blocker: null, completion_criteria: criteria, ai_next_action: null, is_today_focus: today, is_weekly_focus: weekly, focus_date: today ? '2026-06-04' : null, completed_at: null, delay_reason: null, ...audit() };
  }
  function ap(title: string, kr_id: string | null, c6_id: string | null, owner: string, team: string | null, status: string, priority: string, due: string) {
    return { id: crypto.randomUUID(), title, description: null, objective_id: null, key_result_id: kr_id, kpi_id: null, critical_six_id: c6_id, owner_id: owner, team_id: team, start_date: null, due_date: due, status, priority, bucket: null, labels: [], checklist: [], progress: 0, recurrence_rule: null, is_open_on_board: true, external_id: null, data_source: null, ...audit() };
  }
  function acc(company: string, country: string, market: string, owner: string, status: string, grade: string, expected: number, actual: number | null, kr_id: string, followup: string | null, last: string | null) {
    return { id: `acc:${company}`, company_name: company, country, market, account_owner_id: owner, account_status: status, account_grade: grade, expected_revenue: expected, actual_revenue: actual, last_contact_date: last, next_followup_date: followup, related_objective_id: null, related_key_result_id: kr_id, memo: null, ...audit() };
  }
  function opp(name: string, company: string, owner: string, stage: string, expected: number, prob: number, close: string, kr_id: string, next_action: string, risk: string) {
    return { id: crypto.randomUUID(), opportunity_name: name, account_id: `acc:${company}`, owner_id: owner, stage, expected_revenue: expected, probability: prob, expected_close_date: close, related_objective_id: null, related_key_result_id: kr_id, related_kpi_id: null, related_action_plan_id: null, next_action, risk_level: risk, memo: null, ...audit() };
  }
  function insight(type: string, rtype: string, rid: string, team: string, title: string, summary: string, risk: string) {
    return { id: crypto.randomUUID(), insight_type: type, related_type: rtype, related_id: rid, team_id: team, user_id: null, title, summary, risk_level: risk, payload: {}, model: 'rule-engine', is_dismissed: false, valid_until: null, ...audit() };
  }
}

const pct = (cur: number, tgt: number) => (tgt ? Math.round(Math.max(0, Math.min(100, (cur / tgt) * 100)) * 100) / 100 : 0);
const kpiStatus = (cur: number, tgt: number) => {
  if (cur == null) return 'no_data';
  const r = tgt ? (cur / tgt) * 100 : 0;
  return r >= 100 ? 'on_track' : r >= 80 ? 'at_risk' : 'off_track';
};
