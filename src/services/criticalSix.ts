import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { CriticalSix } from '@/types';

const crud = makeCrud<CriticalSix>('critical_six');

export const criticalSixService = {
  ...crud,

  byOwner: (owner_id: string) =>
    crud.list({ filter: { owner_id }, order: { column: 'due_date' } }),

  todayFocus: (owner_id: string) =>
    crud.list({ filter: { owner_id, is_today_focus: true } }),

  async toggleToday(id: string, on: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    return crud.update(id, { is_today_focus: on, focus_date: on ? today : null });
  },

  async complete(id: string) {
    return crud.update(id, { status: 'completed', completed_at: new Date().toISOString() });
  },

  // Active (not done/cancelled) count for the >6 overload nudge in the UI.
  async activeCount(owner_id: string): Promise<number> {
    const { count } = await supabase
      .from('critical_six')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner_id)
      .in('status', ['not_started', 'in_progress', 'at_risk', 'delayed']);
    return count ?? 0;
  },
};
