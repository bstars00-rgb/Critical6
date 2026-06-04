import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { Kpi } from '@/types';

const crud = makeCrud<Kpi>('kpis');

export const kpisService = {
  ...crud,

  list: () => crud.list({ order: { column: 'name' } }),

  // Manual update path (MVP). Records previous_value, appends to kpi_history.
  // achievement_rate + status are recomputed by the DB trigger.
  async updateValue(kpi: Kpi, value: number, note?: string) {
    const updated = await crud.update(kpi.id, {
      previous_value: kpi.current_value,
      current_value: value,
      last_updated_at: new Date().toISOString(),
    });
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    await supabase.from('kpi_history').insert({
      kpi_id: kpi.id, value, source: 'manual', note: note ?? null, created_by: uid, updated_by: uid,
    });
    return updated;
  },

  async history(kpi_id: string) {
    const { data, error } = await supabase
      .from('kpi_history')
      .select('*')
      .eq('kpi_id', kpi_id)
      .order('recorded_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  // CSV: rows of { external_id, value } (parse with parseKpiCsv from
  // @/integrations/dataSources). Matches KPIs by external_id and updates.
  async importCsv(rows: { external_id: string; value: number }[]) {
    const all = await crud.list();
    let updated = 0;
    for (const row of rows) {
      const kpi = all.find((k) => k.external_id === row.external_id);
      if (kpi) { await this.updateValue(kpi, row.value, 'csv_upload'); updated++; }
    }
    return { matched: updated, total: rows.length };
  },
};
