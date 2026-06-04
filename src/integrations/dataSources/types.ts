// Mirrors the data_source_type enum in 0001_enums.sql.
export type DataSourceType =
  | 'manual' | 'csv' | 'google_sheet'
  | 'postgres' | 'mysql' | 'rest_api' | 'webhook'
  | 'booking_db' | 'revenue_db' | 'hotel_mapping_db' | 'client_db'
  | 'supplier_db' | 'api_monitoring_db' | 'crm_db';

export const PHASE: Record<DataSourceType, 1 | 2 | 3> = {
  manual: 1, csv: 1, google_sheet: 1,
  postgres: 2, mysql: 2, rest_api: 2, webhook: 2,
  booking_db: 3, revenue_db: 3, hotel_mapping_db: 3, client_db: 3,
  supplier_db: 3, api_monitoring_db: 3, crm_db: 3,
};
