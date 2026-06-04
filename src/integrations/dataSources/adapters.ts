// Concrete adapters. Phase 1 (manual/csv/sheet) is functional; phase 2/3
// (sql/rest/webhook and the company DBs) share these two implementations behind
// config and are stubbed until the secure server proxy exists.
import type { DataSourceAdapter, MetricQuery, MetricReading, ConnectionResult } from './adapter';
import { AdapterError } from './adapter';
import type { DataSourceType } from './types';
import { parseCsv, pickMetric } from './csv';

const now = () => new Date().toISOString();

/** Manual: values are pushed from the UI; there is nothing to fetch. */
export class ManualAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'manual';
  readonly pushOnly = true;
  async testConnection(): Promise<ConnectionResult> {
    return { ok: true, message: '수동 입력 소스 (가져오기 없음)' };
  }
  async fetchMetric(): Promise<MetricReading> {
    throw new AdapterError('manual source is push-only — update the value in the UI', this.type);
  }
}

/** CSV: config carries the parsed text + column/match; resolves one reading. */
export class CsvAdapter implements DataSourceAdapter {
  readonly type: DataSourceType = 'csv';
  async testConnection(config: Record<string, any>): Promise<ConnectionResult> {
    if (!config?.text) return { ok: false, message: 'CSV text가 없습니다' };
    const t = parseCsv(config.text);
    return { ok: t.rows.length > 0, message: `${t.rows.length} rows, columns: ${t.headers.join(', ')}` };
  }
  async fetchMetric(q: MetricQuery): Promise<MetricReading> {
    const table = parseCsv(q.config.text ?? '');
    const value = pickMetric(table, { column: q.config.column ?? 'value', match: q.config.match });
    return { value, recordedAt: now(), raw: q.config.match };
  }
}

/** REST/company-DB family: real fetch through a config.url. Server proxy in prod. */
export class RestApiAdapter implements DataSourceAdapter {
  constructor(readonly type: DataSourceType = 'rest_api') {}
  async testConnection(config: Record<string, any>): Promise<ConnectionResult> {
    if (!config?.url) return { ok: false, message: 'url이 없습니다' };
    return { ok: true, message: `endpoint: ${config.url}` };
  }
  async fetchMetric(q: MetricQuery): Promise<MetricReading> {
    const res = await fetch(q.config.url, { headers: q.config.headers ?? {} });
    if (!res.ok) throw new AdapterError(`HTTP ${res.status}`, this.type);
    const json = await res.json();
    const value = Number(resolvePath(json, q.config.jsonPath ?? 'value'));
    if (Number.isNaN(value)) throw new AdapterError(`jsonPath "${q.config.jsonPath}" not numeric`, this.type);
    return { value, recordedAt: now(), raw: json };
  }
}

/** Google Sheet / SQL: structure reserved; not callable until server proxy lands. */
export class NotYetAdapter implements DataSourceAdapter {
  constructor(readonly type: DataSourceType) {}
  async testConnection(): Promise<ConnectionResult> {
    return { ok: false, message: `${this.type} 어댑터는 이후 단계에서 구현됩니다` };
  }
  async fetchMetric(): Promise<MetricReading> {
    throw new AdapterError(`${this.type} adapter not implemented yet`, this.type);
  }
}

// Tiny dotted-path resolver: "data.metrics.success_rate".
function resolvePath(obj: any, path: string): unknown {
  return path.replace(/^\$\.?/, '').split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
