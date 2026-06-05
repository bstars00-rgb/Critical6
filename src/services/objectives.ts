import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { Objective, KeyResult, ObjectiveLevel } from '@/types';

const crud = makeCrud<Objective>('objectives');

export interface KrNode extends KeyResult {
  action_plans: any[];
}
export interface ObjectiveNode extends Objective {
  children: ObjectiveNode[];
  key_results: KrNode[];
}

export const objectivesService = {
  ...crud,

  list: (filter?: { level?: ObjectiveLevel; team_id?: string; year?: number }) =>
    crud.list({ filter, order: { column: 'created_at', ascending: false } }),

  // Build the company→team→personal tree with KRs + their Action Plans attached.
  async tree(): Promise<ObjectiveNode[]> {
    const [{ data: objs, error: e1 }, { data: krs, error: e2 }, { data: aps, error: e3 }] = await Promise.all([
      supabase.from('objectives').select('*').order('level'),
      supabase.from('key_results').select('*'),
      supabase.from('action_plans').select('id, title, status, priority, key_result_id, due_date, checklist'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    if (e3) throw e3;

    const objById = new Map<string, ObjectiveNode>();
    const krById = new Map<string, KrNode>();
    (objs ?? []).forEach((o: any) => objById.set(o.id, { ...o, children: [], key_results: [] }));
    (krs ?? []).forEach((k: any) => {
      const node: KrNode = { ...k, action_plans: [] };
      krById.set(k.id, node);
      objById.get(k.objective_id)?.key_results.push(node);
    });
    // Action plans attach to their KR; orphan-but-objective-linked ones are ignored here.
    (aps ?? []).forEach((a: any) => { if (a.key_result_id) krById.get(a.key_result_id)?.action_plans.push(a); });

    const roots: ObjectiveNode[] = [];
    objById.forEach((node) => {
      const parent = node.parent_objective_id && objById.get(node.parent_objective_id);
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
