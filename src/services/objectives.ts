import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { Objective, KeyResult, ObjectiveLevel } from '@/types';

const crud = makeCrud<Objective>('objectives');

export interface ObjectiveNode extends Objective {
  children: ObjectiveNode[];
  key_results: KeyResult[];
}

export const objectivesService = {
  ...crud,

  list: (filter?: { level?: ObjectiveLevel; team_id?: string; year?: number }) =>
    crud.list({ filter, order: { column: 'created_at', ascending: false } }),

  // Build the company→team→personal tree with KRs attached.
  async tree(): Promise<ObjectiveNode[]> {
    const [{ data: objs, error: e1 }, { data: krs, error: e2 }] = await Promise.all([
      supabase.from('objectives').select('*').order('level'),
      supabase.from('key_results').select('*'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const byId = new Map<string, ObjectiveNode>();
    (objs ?? []).forEach((o: any) => byId.set(o.id, { ...o, children: [], key_results: [] }));
    (krs ?? []).forEach((k: any) => byId.get(k.objective_id)?.key_results.push(k));

    const roots: ObjectiveNode[] = [];
    byId.forEach((node) => {
      const parent = node.parent_objective_id && byId.get(node.parent_objective_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    });
    return roots;
  },

  async withRelations(id: string) {
    const [objective, { data: keyResults }, { data: kpis }, { data: critical }, { data: actions }] =
      await Promise.all([
        crud.get(id),
        supabase.from('key_results').select('*').eq('objective_id', id),
        supabase.from('kpis').select('*').eq('objective_id', id),
        supabase.from('critical_six').select('*').eq('objective_id', id),
        supabase.from('action_plans').select('*').eq('objective_id', id),
      ]);
    return {
      objective,
      keyResults: keyResults ?? [],
      kpis: kpis ?? [],
      criticalSix: critical ?? [],
      actionPlans: actions ?? [],
    };
  },
};
