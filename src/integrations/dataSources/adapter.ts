// The single contract every data source implements. KPIs depend ONLY on this —
// never on a concrete database — so phase-3 live DBs plug in without touching
// KPI logic. See docs/data-integration.md.
import type { DataSourceType } from './types';

export interface MetricQuery {
  externalId: string;                 // kpis.external_id — key/query inside the source
  config: Record<string, any>;        // data_sources.connection_config
  since?: string;                     // optional incremental window (ISO)
}

export interface MetricReading {
  value: number;
  recordedAt: string;                 // ISO timestamp
  raw?: unknown;                      // original payload (stored in kpi_history)
}

export interface ConnectionResult {
  ok: boolean;
  message?: string;
}

export interface DataSourceAdapter {
  readonly type: DataSourceType;
  /** Push-only sources (manual) return ok with a note instead of fetching. */
  readonly pushOnly?: boolean;
  testConnection(config: Record<string, any>): Promise<ConnectionResult>;
  fetchMetric(q: MetricQuery): Promise<MetricReading>;
  fetchMetrics?(qs: MetricQuery[]): Promise<MetricReading[]>;
}

export class AdapterError extends Error {
  constructor(message: string, readonly type: DataSourceType) {
    super(message);
    this.name = 'AdapterError';
  }
}
