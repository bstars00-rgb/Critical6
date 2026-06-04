// The ONLY path that refreshes a KPI from its data source. Whatever the source
// (manual/csv/rest/company-DB), this code is identical — it asks the registry
// for an adapter and applies the reading. Achievement rate + status are then
// recomputed by the DB trigger. Mirrors docs/data-integration.md §3.
import { supabase } from '@/lib/supabase';
import { getAdapter, type DataSourceType, type MetricReading } from '@/integrations/dataSources';
import { kpisService } from './kpis';
import type { Kpi } from '@/types';

interface DataSource {
  id: string;
  type: DataSourceType;
  connection_config: Record<string, any>;
}

export const kpiSync = {
  /** Sync one KPI from its linked data source. Writes a data_sync_logs row. */
  async syncKpi(kpi: Kpi): Promise<{ ok: boolean; value?: number; message?: string }> {
    if (!kpi.data_source_id) return { ok: false, message: '연결된 데이터 소스가 없습니다' };

    const { data: src } = await supabase
      .from('data_sources').select('id, type, connection_config').eq('id', kpi.data_source_id).maybeSingle();
    if (!src) return { ok: false, message: '데이터 소스를 찾을 수 없습니다' };
    const source = src as DataSource;

    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data: log } = await supabase.from('data_sync_logs')
      .insert({ data_source_id: source.id, status: 'running', created_by: uid, updated_by: uid })
      .select('id').single();

    try {
      const adapter = getAdapter(source.type);
      const reading: MetricReading = await adapter.fetchMetric({
        externalId: kpi.external_id ?? '',
        config: source.connection_config ?? {},
      });
      await kpisService.updateValue(kpi, reading.value, `sync:${source.type}`);
      await supabase.from('data_sync_logs').update({
        status: 'success', finished_at: new Date().toISOString(), rows_read: 1, rows_written: 1,
      }).eq('id', log?.id);
      return { ok: true, value: reading.value };
    } catch (e: any) {
      await supabase.from('data_sync_logs').update({
        status: 'failed', finished_at: new Date().toISOString(), error_message: String(e?.message ?? e),
      }).eq('id', log?.id);
      return { ok: false, message: String(e?.message ?? e) };
    }
  },
};
