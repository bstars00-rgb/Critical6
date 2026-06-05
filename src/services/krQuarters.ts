import { supabase } from '@/lib/supabase';

export interface KrQuarter {
  id: string; key_result_id: string; year: number; quarter: number;
  target_value: number | null; current_value: number | null;
}

// Current calendar quarter (drives which quarter the KR headline mirrors).
export const currentQuarter = () => Math.floor(new Date().getUTCMonth() / 3) + 1;
export const currentYear = () => new Date().getUTCFullYear();

export const krQuartersService = {
  async byKr(keyResultId: string): Promise<KrQuarter[]> {
    const { data, error } = await supabase.from('kr_quarters')
      .select('*').eq('key_result_id', keyResultId).order('year').order('quarter');
    if (error) throw error;
    return (data ?? []) as KrQuarter[];
  },

  // Upsert one quarter cell; if it's the current calendar quarter, mirror its
  // values onto the KR headline so KR%/Objective% reflect "this quarter".
  async setCell(keyResultId: string, year: number, quarter: number, patch: { target_value?: number | null; current_value?: number | null }) {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    // merge with existing so we don't wipe the other column
    const { data: existing } = await supabase.from('kr_quarters')
      .select('target_value, current_value').match({ key_result_id: keyResultId, year, quarter }).maybeSingle();
    const row = {
      key_result_id: keyResultId, year, quarter,
      target_value: patch.target_value !== undefined ? patch.target_value : existing?.target_value ?? null,
      current_value: patch.current_value !== undefined ? patch.current_value : existing?.current_value ?? null,
      created_by: uid, updated_by: uid,
    };
    const { error } = await supabase.from('kr_quarters').upsert(row, { onConflict: 'key_result_id,year,quarter' });
    if (error) throw error;

    if (year === currentYear() && quarter === currentQuarter()) {
      await supabase.from('key_results').update({
        target_value: row.target_value, current_value: row.current_value, updated_by: uid,
      }).eq('id', keyResultId);
    }
  },
};
