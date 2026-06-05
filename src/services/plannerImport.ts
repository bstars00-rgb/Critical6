// In-app Microsoft Teams Planner importer. Parses the exported .xlsx in the
// browser and writes to Supabase via the authed client (admin) — no SQL editor.
// Mirrors scripts/genimport.mjs. GST team only; idempotent (replaces prior import).
import { supabase } from '@/lib/supabase';

const SRC = 'planner';
const COMPANY = '00000000-0000-4000-8000-000000000001';
const GST_OBJ = '00000000-0000-4000-8000-0000000000a1';
const C_KR = (i: number) => `00000000-0000-4000-8000-0000000000c${i}`;
const GST_KR = (i: number) => `00000000-0000-4000-8000-0000000000d${i}`;

const clean = (s: any) => String(s ?? '').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
const cut = (s: any, n = 280) => clean(s).slice(0, n) || null;
const dateOrNull = (s: any) => (/^\d{4}-\d{2}-\d{2}$/.test(clean(s)) ? clean(s) : null);
const splitList = (s: any) => clean(s).split(/;|\n/).map(clean).filter(Boolean);
// Quarter from a "Q1".."Q4" label or an "N분기" name; target number from a name.
const quarterOf = (name: any, labels: any): number | null => {
  const lq = clean(labels).match(/Q\s*([1-4])/i);
  if (lq) return +lq[1];
  const nm = clean(name).match(/([1-4])\s*분기/);
  return nm ? +nm[1] : null;
};
const targetOf = (name: any): number | null => {
  const s = clean(name).replace(/[1-4]\s*분기/, '').replace(/[, ]/g, '');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? +m[0] : null;
};
const nowQuarter = () => Math.floor(new Date().getUTCMonth() / 3) + 1;
const STATUS: Record<string, string> = { '시작 안 함': 'not_started', '진행 중': 'in_progress', '완료': 'completed' };
const PRIO: Record<string, string> = { '낮음': 'low', '중간': 'medium', '중요': 'important', '긴급': 'urgent' };
const mapStatus = (s: any) => STATUS[clean(s)] ?? 'not_started';
const mapPrio = (p: any) => PRIO[clean(p)] ?? 'medium';
const checklist = (s: any, done: boolean) => splitList(s).map((text, i) => ({ id: 'c' + i, text, done }));
const krFor = (name: string): string | null => {
  const n = clean(name);
  if (/KR1|Active 1000|채널 Active/.test(n)) return GST_KR(1);
  if (/KR2|Daily 7000/.test(n)) return GST_KR(2);
  if (/KR3|TTV ?50|Tier0/.test(n)) return GST_KR(3);
  if (/KR4|중화권/.test(n)) return GST_KR(4);
  if (/KR5|Reve?nue|260/.test(n)) return GST_KR(5);
  return null;
};
const C = { id: 0, name: 1, bucket: 2, status: 4, prio: 5, assignees: 6, due: 9, start: 10, doneDate: 13, checklist: 16, labels: 17, note: 18 };

interface Wb { plan: string; rows: any[][]; users: any[][]; }
async function readWorkbook(file: File): Promise<Wb> {
  const XLSX: any = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sj = (name: string) => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) : []);
  const planRows = sj('플랜');
  return { plan: clean(planRows[1]?.[1]), rows: sj('통합 데이터').slice(1).filter((r: any[]) => clean(r[C.name])), users: sj('사용자').slice(1) };
}

export interface ImportPreview {
  files: { name: string; kind: string; tasks: number }[];
  counts: { objectives: number; keyResults: number; actionPlans: number; criticalSix: number; people: number; quarters: number };
  build: () => Promise<ImportData>;
}
interface ImportData { people: any[]; actionPlans: any[]; criticalSix: any[]; quarters: any[]; hasHQ: boolean; gstTask?: any[]; }

const GST_KR_DEF: [number, string, string, number, string][] = [
  [1, 'KR1 Active Channel 1000', 'active_channel_count', 1000, '개 채널'],
  [2, 'KR2 Daily Booking 7000', 'booking_count', 7000, '건/일'],
  [3, 'KR3 Tier0 (월 TTV 50억) 3곳', 'tier0_count', 3, '곳'],
  [4, 'KR4 중화권 비중 65%로 균형', 'china_share_pct', 65, '%'],
  [5, 'KR5 Revenue 260억', 'revenue', 260, '억원'],
];

function classify(wb: Wb): string {
  const buckets = wb.rows.map((r) => clean(r[C.bucket]));
  if (buckets.includes('Company OKR') || /HQ/.test(wb.plan)) return 'hq';
  if (/Critical6|크리티컬/.test(wb.plan)) return 'critical6';
  if (/Action Plan/.test(wb.plan)) return 'actionplan';
  if (buckets.some((b) => /KR\d|Active 1000|Daily 7000|Tier0|Revenue|중화권/.test(b))) return 'gst_okr';
  return 'unknown';
}

export async function previewPlanner(files: File[]): Promise<ImportPreview> {
  const wbs = await Promise.all(files.map(readWorkbook));
  const tagged = wbs.map((wb, i) => ({ wb, kind: classify(wb), name: files[i].name }));

  const peopleMap = new Map<string, any>();
  for (const { wb } of tagged)
    for (const u of wb.users) {
      const email = clean(u[2]);
      if (email && !peopleMap.has(email)) peopleMap.set(email, { full_name: clean(u[1]), email, planner_user_id: clean(u[0]) });
    }

  const actionPlans: any[] = [];
  const criticalSix: any[] = [];
  const quarters: any[] = [];
  let hasHQ = false; let gstTask: any[] | undefined;

  for (const { wb, kind } of tagged) {
    if (kind === 'hq') {
      hasHQ = true;
      gstTask = wb.rows.find((r) => /Team OKR/.test(clean(r[C.bucket])) && /^GST\s*:/.test(clean(r[C.name])));
    }
    if (kind === 'gst_okr')
      for (const r of wb.rows) {
        const kr = krFor(clean(r[C.bucket]));
        if (!kr) continue;
        const quarter = quarterOf(r[C.name], r[C.labels]);
        const target = targetOf(r[C.name]);
        // A KR-bucket task that encodes a quarterly target → quarterly milestone;
        // otherwise it is a real action plan.
        if (quarter && target != null) quarters.push({ key_result_id: kr, year: 2026, quarter, target_value: target });
        else actionPlans.push(toAction(r));
      }
    if (kind === 'actionplan')
      for (const r of wb.rows) actionPlans.push(toAction(r));
    if (kind === 'critical6')
      for (const r of wb.rows) criticalSix.push(toC6(r));
  }

  // dedupe quarters by (kr, quarter) — keep the last seen
  const qmap = new Map<string, any>();
  for (const q of quarters) qmap.set(`${q.key_result_id}:${q.quarter}`, q);
  const quartersD = [...qmap.values()];

  const companyKrCount = hasHQ ? 5 : 0;
  const objectives = 1 + 1; // company + GST
  return {
    files: tagged.map((t) => ({ name: t.name, kind: t.kind, tasks: t.wb.rows.length })),
    counts: { objectives, keyResults: 5 + companyKrCount, actionPlans: actionPlans.length, criticalSix: criticalSix.length, people: peopleMap.size, quarters: quartersD.length },
    build: async () => ({ people: [...peopleMap.values()], actionPlans, criticalSix, quarters: quartersD, hasHQ, gstTask }),
  };

  function toAction(r: any[]) {
    const completed = clean(r[C.status]) === '완료';
    const kr = krFor(clean(r[C.labels]) + ' ' + clean(r[C.bucket]));
    return {
      title: cut(r[C.name], 200), description: cut(r[C.note]),
      key_result_id: kr, objective_id: kr ? null : GST_OBJ,
      status: mapStatus(r[C.status]), priority: mapPrio(r[C.prio]),
      bucket: clean(r[C.bucket]) || null, labels: splitList(r[C.labels]),
      checklist: checklist(r[C.checklist], completed), external_assignees: splitList(r[C.assignees]),
      start_date: dateOrNull(r[C.start]), due_date: dateOrNull(r[C.due]),
      external_id: clean(r[C.id]), external_source: SRC, data_source: 'planner',
    };
  }
  function toC6(r: any[]) {
    return {
      title: cut(r[C.name], 200), description: cut(r[C.note]),
      key_result_id: krFor(clean(r[C.bucket])), objective_id: GST_OBJ,
      status: mapStatus(r[C.status]), priority: mapPrio(r[C.prio]),
      completion_criteria: cut(splitList(r[C.checklist]).join(' · '), 280),
      external_assignees: splitList(r[C.assignees]),
      completed_at: clean(r[C.status]) === '완료' && dateOrNull(r[C.doneDate]) ? `${dateOrNull(r[C.doneDate])}T00:00:00Z` : null,
      due_date: dateOrNull(r[C.due]), external_id: clean(r[C.id]), external_source: SRC,
    };
  }
}

export async function applyPlanner(data: ImportData, onStep?: (m: string) => void): Promise<{ ok: boolean; message: string }> {
  const step = (m: string) => onStep?.(m);
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  if (!uid) return { ok: false, message: '로그인이 필요합니다' };
  const stamp = { created_by: uid, updated_by: uid };

  try {
    step('기존 임포트 정리…');
    for (const t of ['critical_six', 'action_plans', 'key_results', 'objectives'] as const)
      await supabase.from(t).delete().eq('external_source', SRC).throwOnError();

    step('팀(GST) 준비…');
    const { data: team } = await supabase.from('teams')
      .upsert({ name: 'GST', slug: 'gst', ...stamp }, { onConflict: 'slug' }).select('id').single().throwOnError();
    const teamId = team!.id;
    await supabase.from('team_members').upsert({ team_id: teamId, user_id: uid, team_role: 'leader', ...stamp }, { onConflict: 'team_id,user_id' });

    if (data.people.length) {
      step(`팀원 ${data.people.length}명…`);
      await supabase.from('people').upsert(data.people.map((p) => ({ ...p, ...stamp })), { onConflict: 'email' });
    }

    step('OKR 구조…');
    await supabase.from('objectives').insert([
      { id: COMPANY, title: '오마이호텔(OMH) 2026', description: 'HQ 전사 OKR', level: 'company', owner_id: uid, status: 'in_progress', priority: 'critical', year: 2026, external_id: 'hq-2026', external_source: SRC, ...stamp },
      { id: GST_OBJ, title: clean(data.gstTask?.[C.name]) || 'GST : 아시아 최정상 Bed Bank', description: cut(data.gstTask?.[C.note]) || 'GST 팀 2026 목표', level: 'team', owner_id: uid, team_id: teamId, parent_objective_id: COMPANY, status: 'in_progress', priority: 'urgent', year: 2026, external_id: 'gst-2026', external_source: SRC, ...stamp },
    ]).throwOnError();

    await supabase.from('key_results').insert(GST_KR_DEF.map(([i, title, metric, target, unit]) => ({
      id: GST_KR(i), objective_id: GST_OBJ, title, metric_type: metric, target_value: target, current_value: 0, unit, owner_id: uid, status: 'in_progress', priority: 'important', external_source: SRC, ...stamp,
    }))).throwOnError();

    const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
    if (data.actionPlans.length) {
      step(`Action Plan ${data.actionPlans.length}건…`);
      for (const part of chunk(data.actionPlans, 100))
        await supabase.from('action_plans').insert(part.map((a) => ({ ...a, team_id: teamId, owner_id: uid, ...stamp }))).throwOnError();
    }
    if (data.criticalSix.length) {
      step(`Critical 6 ${data.criticalSix.length}건…`);
      for (const part of chunk(data.criticalSix, 100))
        await supabase.from('critical_six').insert(part.map((c) => ({ ...c, team_id: teamId, owner_id: uid, ...stamp }))).throwOnError();
    }

    // Quarterly KR targets (kr_quarters); mirror the current quarter onto the KR.
    if (data.quarters.length) {
      step(`분기 목표 ${data.quarters.length}건…`);
      await supabase.from('kr_quarters')
        .upsert(data.quarters.map((q) => ({ ...q, ...stamp })), { onConflict: 'key_result_id,year,quarter' })
        .throwOnError();
      const q = nowQuarter();
      for (const cell of data.quarters.filter((x) => x.year === 2026 && x.quarter === q))
        await supabase.from('key_results').update({ target_value: cell.target_value, updated_by: uid }).eq('id', cell.key_result_id);
    }

    return { ok: true, message: `완료: Objective 2, KR 5, 분기목표 ${data.quarters.length}, Action ${data.actionPlans.length}, Critical6 ${data.criticalSix.length}, 팀원 ${data.people.length}` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}
