# Data Integration — Source Abstraction & Adapter Layer

The system must run with **zero real company DBs connected** (manual/CSV only),
yet allow any DB/API to be plugged in later **without changing KPI logic**. We
achieve this by making KPIs depend on an abstract `DataSourceAdapter`, never on a
concrete database.

## 1. Rollout phases

| Phase | Sources | `data_sources.type` | `connection_method` |
|---|---|---|---|
| **1 (MVP)** | Manual input, CSV upload, Google Sheet import | `manual`, `csv`, `google_sheet` | `manual`, `file`, `sheet` |
| **2** | PostgreSQL, MySQL, REST API, Webhook | `postgres`, `mysql`, `rest_api`, `webhook` | `jdbc`, `api`, `webhook` |
| **3** | Booking / Revenue / Hotel-Mapping / Client / Supplier / API-Monitoring / CRM DBs | `*_db` | `jdbc`, `api` |

Only the **adapter implementations** grow across phases. The KPI service,
schema, and UI stay constant.

## 2. The contract

Every source implements one interface. KPIs call this — nothing else.

```ts
// services/data-sources/adapter.ts
export interface MetricQuery {
  externalId: string;            // kpis.external_id — query/key inside the source
  config: Record<string, any>;   // data_sources.connection_config
  since?: string;                // optional incremental window
}

export interface MetricReading {
  value: number;
  recordedAt: string;            // ISO timestamp
  raw?: unknown;                 // original payload, stored in kpi_history.note/details
}

export interface DataSourceAdapter {
  readonly type: DataSourceType;
  testConnection(config: Record<string, any>): Promise<{ ok: boolean; message?: string }>;
  fetchMetric(q: MetricQuery): Promise<MetricReading>;
  // batch variant for scheduled syncs
  fetchMetrics(qs: MetricQuery[]): Promise<MetricReading[]>;
}
```

## 3. Registry + service layer

```ts
// services/data-sources/registry.ts
const adapters: Partial<Record<DataSourceType, DataSourceAdapter>> = {
  manual:       new ManualAdapter(),       // value comes from UI input
  csv:          new CsvAdapter(),          // parse uploaded file → reading
  google_sheet: new GoogleSheetAdapter(),
  // phase 2+
  postgres:     new SqlAdapter('postgres'),
  mysql:        new SqlAdapter('mysql'),
  rest_api:     new RestApiAdapter(),
  webhook:      new WebhookAdapter(),
  // phase 3 — thin configs over SqlAdapter/RestApiAdapter:
  revenue_db:       new SqlAdapter('postgres'),
  booking_db:       new SqlAdapter('postgres'),
  api_monitoring_db:new RestApiAdapter(),
  // ...
};
export const getAdapter = (t: DataSourceType) => adapters[t]
  ?? throwUnsupported(t);
```

```ts
// services/kpi/sync.ts  — the ONLY place KPIs get refreshed.
export async function syncKpi(kpi: Kpi): Promise<void> {
  const log = await startSyncLog(kpi.data_source_id);
  try {
    const source  = await getDataSource(kpi.data_source_id);
    const adapter = getAdapter(source.type);                  // ← abstraction
    const reading = await adapter.fetchMetric({
      externalId: kpi.external_id,
      config: source.connection_config,
    });
    await applyKpiReading(kpi, reading, log.id);              // writes kpi + kpi_history
    await finishSyncLog(log.id, 'success', { rowsWritten: 1 });
  } catch (e) {
    await finishSyncLog(log.id, 'failed', { error: String(e) });
    await notifySyncFailed(kpi, e);
  }
}
```

`applyKpiReading` updates `kpis.current_value`/`previous_value`/`last_updated_at`
(the DB trigger recomputes `achievement_rate` + `status`) and appends a
`kpi_history` row. **Swapping a manual KPI to a live Revenue DB = change the
KPI's `data_source_id`. No business logic changes.**

## 4. `connection_config` shapes (per adapter)

```jsonc
// manual        → {}
// csv           → { "column": "active_channels", "match": {"market":"SEA"} }
// google_sheet  → { "spreadsheetId": "...", "range": "KPI!B2", "secretRef": "vault:gs_token" }
// postgres/mysql→ { "secretRef": "vault:revenue_db", "query": "select count(*) from channels where active" }
// rest_api      → { "url": "https://.../metrics", "jsonPath": "$.data.success_rate", "secretRef": "vault:api_key" }
// webhook       → { "expectedField": "value", "signatureSecretRef": "vault:wh_sig" }
```

> Secrets live in **Supabase Vault**; `connection_config` stores only a
> `secretRef`. Never persist raw credentials.

## 5. Sync orchestration

- `data_sources.sync_frequency` (cron-ish) drives a scheduled worker
  (Supabase Edge Function / pg_cron) that calls `syncKpi` for each KPI on that
  source.
- Every run writes a `data_sync_logs` row (`running`→`success|partial|failed`,
  rows read/written, error). The KPI screen shows last-sync status; failures
  raise a `sync_failed` notification.
- Webhooks invert the flow: an inbound endpoint validates the signature, maps
  payload→`MetricReading`, and calls `applyKpiReading` directly.

## 6. Example (matches the brief)

- **Monthly Revenue KPI** → `data_source.type = revenue_db`,
  `external_id = "mrr_sea"`, config query sums revenue. Adapter = SqlAdapter.
- **API Success Rate KPI** → `type = api_monitoring_db`,
  `external_id = "success_rate_24h"`, config hits a metrics endpoint.
  Adapter = RestApiAdapter.

Both KPIs are read through the same `syncKpi` path; the UI and KR roll-up never
know which database answered.
