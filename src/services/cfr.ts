import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { CfrCheckin, CfrRelatedType } from '@/types';

const crud = makeCrud<CfrCheckin>('cfr_checkins');

// Re-exported for existing imports (`@/services/cfr`). Logic lives in lib/date
// so it stays unit-testable without pulling the Supabase client.
export { weekStart } from '@/lib/date';
import { weekStart } from '@/lib/date';

export const cfrService = {
  ...crud,

  byUser: (user_id: string) =>
    crud.list({ filter: { user_id }, order: { column: 'week_start_date', ascending: false } }),

  byTarget: (related_type: CfrRelatedType, related_id: string) =>
    crud.list({ filter: { related_type, related_id }, order: { column: 'week_start_date', ascending: false } }),

  async forWeek(user_id: string, related_type: CfrRelatedType, related_id: string, week = weekStart()) {
    const { data, error } = await supabase
      .from('cfr_checkins')
      .select('*')
      .match({ user_id, related_type, related_id, week_start_date: week })
      .maybeSingle();
    if (error) throw error;
    return data as CfrCheckin | null;
  },

  // Upsert this week's check-in (one per user/target/week — unique constraint).
  async submit(values: Partial<CfrCheckin>) {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const payload = {
      ...values,
      week_start_date: values.week_start_date ?? weekStart(),
      submitted_at: new Date().toISOString(),
      created_by: uid,
      updated_by: uid,
    };
    const { data, error } = await supabase
      .from('cfr_checkins')
      .upsert(payload, { onConflict: 'related_type,related_id,user_id,week_start_date' })
      .select('*')
      .single();
    if (error) throw error;
    return data as CfrCheckin;
  },
};
