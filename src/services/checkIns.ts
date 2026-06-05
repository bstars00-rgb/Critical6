import { supabase } from '@/lib/supabase';

export interface CheckIn {
  id: string; key_result_id: string; user_id: string | null;
  value: number | null; status: string | null; confidence: number | null;
  note: string | null; created_at: string;
}

export const checkInsService = {
  // Record a KR check-in. The DB trigger mirrors value/status onto the KR, which
  // recomputes KR% and rolls up to the parent Objective.
  async create(v: { key_result_id: string; value?: number | null; status?: string | null; confidence?: number | null; note?: string | null }) {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase.from('check_ins')
      .insert({ ...v, user_id: uid, created_by: uid, updated_by: uid })
      .select().single();
    if (error) throw error;
    return data as CheckIn;
  },

  async byKr(keyResultId: string, limit = 20) {
    const { data, error } = await supabase.from('check_ins')
      .select('*, users:user_id(full_name)')
      .eq('key_result_id', keyResultId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as any[];
  },

  async latestByKrs(keyResultIds: string[]) {
    if (!keyResultIds.length) return new Map<string, CheckIn>();
    const { data } = await supabase.from('check_ins')
      .select('*').in('key_result_id', keyResultIds).order('created_at', { ascending: false });
    const m = new Map<string, CheckIn>();
    (data ?? []).forEach((c: any) => { if (!m.has(c.key_result_id)) m.set(c.key_result_id, c); });
    return m;
  },
};
