import { supabase } from '@/lib/supabase';

export interface CalEvent {
  id: string;
  title: string;
  start: string;       // YYYY-MM-DD
  kind: 'critical_six' | 'action_plan' | 'key_result';
  status: string;
}

const COLOR: Record<string, string> = {
  critical_six: '#ef4444', action_plan: '#3b6fff', key_result: '#10b981',
};

// Due-dated items across the system for the calendar grid.
export const calendarService = {
  async events(): Promise<(CalEvent & { color: string })[]> {
    const [c6, ap, kr] = await Promise.all([
      supabase.from('critical_six').select('id, title, due_date, status').not('due_date', 'is', null),
      supabase.from('action_plans').select('id, title, due_date, status').not('due_date', 'is', null),
      supabase.from('key_results').select('id, title, due_date, status').not('due_date', 'is', null),
    ]);
    const map = (rows: any[], kind: CalEvent['kind']) =>
      rows.map((r) => ({ id: `${kind}:${r.id}`, title: r.title, start: r.due_date, kind, status: r.status, color: COLOR[kind] }));
    return [
      ...map(c6.data ?? [], 'critical_six'),
      ...map(ap.data ?? [], 'action_plan'),
      ...map(kr.data ?? [], 'key_result'),
    ];
  },
};
