-- =============================================================================
-- AI Execution OS — 0001_enums.sql
-- Enum types shared across the schema.
-- Open-ended vocabularies (metric_type, label, bucket...) intentionally stay as
-- text so product/admin can extend them without a migration.
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";     -- fuzzy search on titles

-- System-level role (one per user). Team-level role lives on team_members.
create type user_role as enum ('admin', 'executive', 'team_leader', 'member');

-- Role a user holds *within* a specific team (multi-team membership).
create type team_role as enum ('leader', 'member', 'viewer');

-- Cross-team view grant level.
create type team_access_level as enum ('view', 'comment', 'edit');

create type objective_level as enum ('company', 'team', 'personal');

-- OKR / KR lifecycle.
create type okr_status as enum (
  'not_started', 'in_progress', 'at_risk', 'delayed',
  'completed', 'on_hold', 'cancelled'
);

-- Critical 6 / Action Plan lifecycle (no on_hold).
create type task_status as enum (
  'not_started', 'in_progress', 'at_risk', 'delayed', 'completed', 'cancelled'
);

create type priority_level as enum ('low', 'medium', 'important', 'urgent', 'critical');

-- Polymorphic targets.
create type cfr_related_type as enum ('objective', 'key_result', 'critical_six', 'action_plan');
create type comment_related_type as enum (
  'objective', 'key_result', 'kpi', 'critical_six',
  'action_plan', 'cfr_checkin', 'crm_account', 'crm_opportunity'
);
create type attachment_related_type as enum (
  'objective', 'key_result', 'kpi', 'critical_six',
  'action_plan', 'cfr_checkin', 'crm_account', 'crm_opportunity'
);

create type crm_account_status as enum ('prospect', 'active', 'inactive', 'churned');
create type crm_account_grade  as enum ('strategic', 'a', 'b', 'c');
create type crm_stage as enum (
  'lead', 'contacted', 'meeting', 'proposal', 'negotiation',
  'contract', 'integration', 'active', 'lost', 'on_hold'
);

-- Data source / sync abstraction.
create type data_source_type as enum (
  'manual', 'csv', 'google_sheet',
  'postgres', 'mysql', 'rest_api', 'webhook',
  'booking_db', 'revenue_db', 'hotel_mapping_db', 'client_db',
  'supplier_db', 'api_monitoring_db', 'crm_db'
);
create type connection_method as enum ('manual', 'file', 'sheet', 'jdbc', 'api', 'webhook');
create type data_source_status as enum ('draft', 'connected', 'error', 'disabled');
create type sync_status as enum ('success', 'partial', 'failed', 'running');

create type kpi_update_method as enum ('manual', 'csv_upload', 'google_sheet', 'database', 'api', 'crm');
create type kpi_status as enum ('on_track', 'at_risk', 'off_track', 'no_data');

create type risk_level as enum ('none', 'low', 'medium', 'high', 'critical');

create type ai_insight_type as enum (
  'okr_quality', 'risk_detection', 'priority_recommendation', 'next_action',
  'executive_summary', 'cfr_analysis', 'kpi_anomaly', 'workload_warning'
);

create type notification_type as enum (
  'cfr_due', 'blocker', 'at_risk', 'mention', 'assignment',
  'followup', 'ai_alert', 'recognition', 'sync_failed'
);
