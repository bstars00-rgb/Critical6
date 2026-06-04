import { supabase } from '@/lib/supabase';
import { weekStart } from './cfr';

// Aggregations for the Dashboard / Executive / Team screens. Reads the SQL views
// from 0005_views.sql plus a few direct counts.
export const dashboardService = {
  async summary() {
    const [objs, krs, c6, actions, cfrWeek] = await Promise.all([
      supabase.from('objectives').select('id, level, status, progress, team_id'),
      supabase.from('key_results').select('id, status, progress'),
      supabase.from('critical_six').select('id, status, is_today_focus'),
      supabase.from('action_plans').select('id, status, objective_id, key_result_id, kpi_id, critical_six_id'),
      supabase.from('cfr_checkins').select('id, user_id').eq('week_start_date', weekStart()),
    ]);

    const O = objs.data ?? [];
    const K = krs.data ?? [];
    const C = c6.data ?? [];
    const A = actions.data ?? [];

    const avg = (xs: { progress: number }[]) =>
      xs.length ? Math.round(xs.reduce((s, x) => s + Number(x.progress), 0) / xs.length) : 0;

    const atRiskKr = K.filter((k) => k.status === 'at_risk' || k.status === 'delayed').length;
    const delayed = [...K, ...A, ...C].filter((x: any) => x.status === 'delayed').length;
    const c6Done = C.filter((x) => x.status === 'completed').length;
    const orphanActions = A.filter(
      (a: any) => !a.objective_id && !a.key_result_id && !a.kpi_id && !a.critical_six_id,
    ).length;

    return {
      overallProgress: avg(K),
      companyObjectives: O.filter((o) => o.level === 'company'),
      objectiveCount: O.length,
      krCount: K.length,
      atRiskKr,
      delayed,
      c6Completion: C.length ? Math.round((c6Done / C.length) * 100) : 0,
      todayFocus: C.filter((x) => x.is_today_focus).length,
      cfrSubmitted: new Set((cfrWeek.data ?? []).map((r: any) => r.user_id)).size,
      orphanActions,
    };
  },

  async kpiAchievement() {
    const { data } = await supabase.from('kpis').select('name, achievement_rate, status, unit, current_value, target_value');
    return data ?? [];
  },

  async aiInsights(limit = 10) {
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async teamProgress() {
    const { data } = await supabase.from('objectives').select('team_id, progress, teams(name)');
    const byTeam = new Map<string, { name: string; sum: number; n: number }>();
    (data ?? []).forEach((o: any) => {
      if (!o.team_id) return;
      const e = byTeam.get(o.team_id) ?? { name: o.teams?.name ?? '—', sum: 0, n: 0 };
      e.sum += Number(o.progress); e.n += 1;
      byTeam.set(o.team_id, e);
    });
    return [...byTeam.values()].map((e) => ({ team: e.name, progress: Math.round(e.sum / e.n) }));
  },
};
