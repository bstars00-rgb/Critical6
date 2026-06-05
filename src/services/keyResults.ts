import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { KeyResult } from '@/types';

const crud = makeCrud<KeyResult>('key_results');

export const keyResultsService = {
  ...crud,
  byObjective: (objective_id: string) =>
    crud.list({ filter: { objective_id }, order: { column: 'created_at' } }),

  async withRelations(id: string) {
    const [kr, { data: kpis }, { data: c6 }, { data: aps }, { data: cis }] = await Promise.all([
      crud.get(id),
      supabase.from('kpis').select('*').eq('key_result_id', id),
      supabase.from('critical_six').select('*').eq('key_result_id', id).order('due_date'),
      supabase.from('action_plans').select('*').eq('key_result_id', id).order('created_at', { ascending: false }),
      supabase.from('check_ins').select('*, users:user_id(full_name)').eq('key_result_id', id).order('created_at', { ascending: false }).limit(30),
    ]);
    let objective: any = null;
    if (kr?.objective_id) objective = (await supabase.from('objectives').select('id, title, level').eq('id', kr.objective_id).maybeSingle()).data;
    return { kr, objective, kpis: kpis ?? [], criticalSix: c6 ?? [], actionPlans: aps ?? [], checkIns: cis ?? [] };
  },
};
