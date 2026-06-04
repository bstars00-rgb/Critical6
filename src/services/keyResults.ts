import { makeCrud } from './crud';
import type { KeyResult } from '@/types';

const crud = makeCrud<KeyResult>('key_results');

export const keyResultsService = {
  ...crud,
  byObjective: (objective_id: string) =>
    crud.list({ filter: { objective_id }, order: { column: 'created_at' } }),
};
