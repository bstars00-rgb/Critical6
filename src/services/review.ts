import { supabase } from '@/lib/supabase';
import { weekStart } from '@/lib/date';
import type { User } from '@/types';

// Gathers the inputs the Weekly AI Review / Team Briefing need. Optionally
// scoped to a team. Pure data assembly — the AI shaping happens in aiService.
export const reviewService = {
  async weeklyInputs(teamId?: string) {
    const week = weekStart();
    const eqTeam = <T extends { eq: (...a: any) => T }>(q: T) => (teamId ? q.eq('team_id', teamId) : q);

    const [krRes, c6Res, apRes, cfrRes, memRes] = await Promise.all([
      supabase.from('key_results').select('id, title, status, progress, due_date, owner_id'),
      eqTeam(supabase.from('critical_six').select('id, title, status, owner_id, completed_at') as any),
      eqTeam(supabase.from('action_plans').select('id, title, status, owner_id') as any),
      eqTeam(supabase.from('cfr_checkins').select('user_id') as any).eq('week_start_date', week),
      teamId
        ? supabase.from('team_members').select('user_id, users(*)').eq('team_id', teamId)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const krs = krRes.data ?? [];
    const c6 = (c6Res as any).data ?? [];
    const aps = (apRes as any).data ?? [];
    const tasks = [...c6, ...aps];

    const submitted = new Set(((cfrRes as any).data ?? []).map((r: any) => r.user_id));
    const members: User[] = ((memRes as any).data ?? []).map((r: any) => r.users);
    const membersWithoutCfr = members.filter((m) => m && !submitted.has(m.id));

    return {
      completed: tasks.filter((t: any) => t.status === 'completed'),
      delayed: tasks.filter((t: any) => t.status === 'delayed' || t.status === 'at_risk'),
      atRiskKr: krs.filter((k: any) => k.status === 'at_risk' || k.status === 'delayed'),
      membersWithoutCfr,
      members,
      week,
    };
  },

  // Per-member rollup for the Team Review screen.
  async teamBreakdown(teamId: string) {
    const week = weekStart();
    const [memRes, krRes, c6Res, apRes, cfrRes] = await Promise.all([
      supabase.from('team_members').select('user_id, team_role, users(*)').eq('team_id', teamId),
      supabase.from('key_results').select('id, title, status, progress, owner_id'),
      supabase.from('critical_six').select('id, status, owner_id').eq('team_id', teamId),
      supabase.from('action_plans').select('id, status, owner_id').eq('team_id', teamId),
      supabase.from('cfr_checkins').select('user_id').eq('team_id', teamId).eq('week_start_date', week),
    ]);

    const krs = krRes.data ?? [];
    const tasks = [...(c6Res.data ?? []), ...(apRes.data ?? [])];
    const submitted = new Set((cfrRes.data ?? []).map((r: any) => r.user_id));

    const members = (memRes.data ?? []).map((m: any) => {
      const uid = m.user_id;
      const myTasks = tasks.filter((t: any) => t.owner_id === uid);
      const myKrs = krs.filter((k: any) => k.owner_id === uid);
      const avg = myKrs.length ? Math.round(myKrs.reduce((s, k: any) => s + Number(k.progress), 0) / myKrs.length) : 0;
      return {
        user: m.users, role: m.team_role,
        taskCount: myTasks.length,
        delayed: myTasks.filter((t: any) => t.status === 'delayed' || t.status === 'at_risk').length,
        krProgress: avg,
        cfrSubmitted: submitted.has(uid),
      };
    });

    const atRiskKr = krs.filter((k: any) => k.status === 'at_risk' || k.status === 'delayed');
    return { members, atRiskKr };
  },
};
