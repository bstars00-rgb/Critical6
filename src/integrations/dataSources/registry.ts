// Maps a DataSourceType → its adapter. The ONLY place that knows which concrete
// implementation backs each source. KPI sync calls getAdapter(type) and nothing
// else — swapping a manual KPI to a live Revenue DB never touches KPI logic.
import type { DataSourceAdapter } from './adapter';
import type { DataSourceType } from './types';
import { ManualAdapter, CsvAdapter, RestApiAdapter, NotYetAdapter } from './adapters';

const registry: Record<DataSourceType, DataSourceAdapter> = {
  // phase 1
  manual: new ManualAdapter(),
  csv: new CsvAdapter(),
  google_sheet: new NotYetAdapter('google_sheet'),
  // phase 2
  postgres: new NotYetAdapter('postgres'),
  mysql: new NotYetAdapter('mysql'),
  rest_api: new RestApiAdapter('rest_api'),
  webhook: new NotYetAdapter('webhook'),
  // phase 3 — company DBs reuse the SQL/REST implementations behind config
  booking_db: new NotYetAdapter('booking_db'),
  revenue_db: new NotYetAdapter('revenue_db'),
  hotel_mapping_db: new NotYetAdapter('hotel_mapping_db'),
  client_db: new NotYetAdapter('client_db'),
  supplier_db: new NotYetAdapter('supplier_db'),
  api_monitoring_db: new RestApiAdapter('api_monitoring_db'),
  crm_db: new NotYetAdapter('crm_db'),
};

export const getAdapter = (type: DataSourceType): DataSourceAdapter => registry[type];
