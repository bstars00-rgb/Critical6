import { makeCrud } from './crud';
import type { ActionPlan } from '@/types';

const crud = makeCrud<ActionPlan>('action_plans');

export const actionPlansService = {
  ...crud,

  board: () => crud.list({ order: { column: 'created_at', ascending: false } }),

  byOwner: (owner_id: string) =>
    crud.list({ filter: { owner_id }, order: { column: 'due_date' } }),

  // Orphans — not linked to any OKR/KPI/Critical6. Surfaced to push alignment.
  async unconnected(): Promise<ActionPlan[]> {
    const all = await crud.list();
    return all.filter(
      (a) => !a.objective_id && !a.key_result_id && !a.kpi_id && !a.critical_six_id && a.status !== 'cancelled',
    );
  },

  move: (id: string, status: ActionPlan['status']) => crud.update(id, { status }),
};
