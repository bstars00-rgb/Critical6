-- AI Execution OS — production setup (run once in Supabase SQL editor).
-- Concatenation of migrations 0001–0006. Does NOT include demo seed.
-- After running, sign up in the app — the first account becomes admin.


-- ==================== supabase/migrations/0001_enums.sql ====================

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

-- ==================== supabase/migrations/0002_tables.sql ====================

-- =============================================================================
-- AI Execution OS — 0002_tables.sql
-- Core relational model. Every table carries the audit quintet:
--   id, created_at, updated_at, created_by, updated_by
-- updated_at is maintained by trigger (0003). created_by/updated_by reference
-- public.users (the app identity), not auth.users.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- IDENTITY & ORG
-- ----------------------------------------------------------------------------

-- App-level identity. id == auth.users.id (Supabase Auth is the source of truth
-- for credentials; this row holds the profile + system role).
create table users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  avatar_url  text,
  role        user_role not null default 'member',  -- system role
  title       text,                                  -- job title, e.g. "GST Channel Lead"
  is_active   boolean not null default true,
  settings    jsonb not null default '{}'::jsonb,    -- per-user prefs
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references users (id),
  updated_by  uuid references users (id)
);

create table teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique,
  description  text,
  parent_team_id uuid references teams (id) on delete set null,  -- org tree
  lead_user_id uuid references users (id),                        -- primary leader
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references users (id),
  updated_by   uuid references users (id)
);

-- A user can belong to MANY teams, with a per-team role.
create table team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  team_role   team_role not null default 'member',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references users (id),
  updated_by  uuid references users (id),
  unique (team_id, user_id)
);

-- Cross-team visibility grants: lets a team leader (or anyone) see another team
-- beyond their own membership. "팀장은 권한이 있으면 다른 팀도 조회 가능."
create table team_access (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  team_id      uuid not null references teams (id) on delete cascade,
  access_level team_access_level not null default 'view',
  granted_by   uuid references users (id),
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references users (id),
  updated_by   uuid references users (id),
  unique (user_id, team_id)
);

-- ----------------------------------------------------------------------------
-- OKR
-- ----------------------------------------------------------------------------

create table objectives (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  level               objective_level not null,
  owner_id            uuid references users (id),               -- primary owner
  team_id             uuid references teams (id) on delete set null,
  parent_objective_id uuid references objectives (id) on delete set null, -- company→team→personal
  start_date          date,
  due_date            date,
  status              okr_status not null default 'not_started',
  priority            priority_level not null default 'medium',
  progress            numeric(5,2) not null default 0,          -- 0..100, auto-calc from KRs
  confidence_score    numeric(3,1),                             -- 0..10, self/AI assessed
  quarter             smallint check (quarter between 1 and 4),
  year                smallint,
  tags                text[] not null default '{}',
  memo                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references users (id),
  updated_by          uuid references users (id)
);

-- Multiple owners per Objective (primary owner_id above + co-owners here).
create table objective_owners (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references objectives (id) on delete cascade,
  user_id      uuid not null references users (id) on delete cascade,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references users (id),
  updated_by   uuid references users (id),
  unique (objective_id, user_id)
);

create table key_results (
  id               uuid primary key default gen_random_uuid(),
  objective_id     uuid not null references objectives (id) on delete cascade,
  title            text not null,
  description      text,
  metric_type      text,                          -- open vocabulary
  baseline_value   numeric,                        -- start point for progress math
  target_value     numeric,
  current_value    numeric default 0,
  unit             text,
  progress         numeric(5,2) not null default 0, -- auto-calc
  confidence_score numeric(3,1),
  owner_id         uuid references users (id),
  start_date       date,
  due_date         date,
  status           okr_status not null default 'not_started',
  priority         priority_level not null default 'medium',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references users (id),
  updated_by       uuid references users (id)
);

create table key_result_owners (
  id            uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references key_results (id) on delete cascade,
  user_id       uuid not null references users (id) on delete cascade,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references users (id),
  updated_by    uuid references users (id),
  unique (key_result_id, user_id)
);

-- ----------------------------------------------------------------------------
-- DATA SOURCES (abstraction layer — see docs/data-integration.md)
-- ----------------------------------------------------------------------------

create table data_sources (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              data_source_type not null,
  connection_method connection_method not null default 'manual',
  -- connection_config holds method-specific settings. NEVER store raw secrets
  -- here in prod — store a vault/secret ref. Shape is documented per adapter.
  connection_config jsonb not null default '{}'::jsonb,
  sync_frequency    text,                 -- cron-ish: 'manual','hourly','daily','*/15 * * * *'
  last_sync_at      timestamptz,
  status            data_source_status not null default 'draft',
  owner_id          uuid references users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references users (id),
  updated_by        uuid references users (id)
);

create table data_sync_logs (
  id             uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references data_sources (id) on delete cascade,
  status         sync_status not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  rows_read      integer,
  rows_written   integer,
  error_message  text,
  details        jsonb not null default '{}'::jsonb,   -- per-run metrics, query, etc.
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references users (id),
  updated_by     uuid references users (id)
);

-- ----------------------------------------------------------------------------
-- KPI
-- ----------------------------------------------------------------------------

create table kpis (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  key_result_id    uuid references key_results (id) on delete set null,
  objective_id     uuid references objectives (id) on delete set null,
  team_id          uuid references teams (id) on delete set null,
  owner_id         uuid references users (id),
  metric_type      text,                          -- revenue, active_channel_count, ...
  unit             text,
  target_value     numeric,
  current_value    numeric,
  previous_value   numeric,
  achievement_rate numeric(6,2),                  -- auto-calc: current/target*100
  update_frequency text,                          -- daily, weekly, monthly...
  update_method    kpi_update_method not null default 'manual',
  data_source_id   uuid references data_sources (id) on delete set null,
  external_id      text,                          -- key/query id inside the source
  last_updated_at  timestamptz,
  status           kpi_status not null default 'no_data',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references users (id),
  updated_by       uuid references users (id)
);

-- Time series of KPI readings — powers trend charts and anomaly detection.
create table kpi_history (
  id             uuid primary key default gen_random_uuid(),
  kpi_id         uuid not null references kpis (id) on delete cascade,
  value          numeric not null,
  recorded_at    timestamptz not null default now(),
  source         kpi_update_method not null default 'manual',
  data_source_id uuid references data_sources (id) on delete set null,
  sync_log_id    uuid references data_sync_logs (id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references users (id),
  updated_by     uuid references users (id)
);

-- ----------------------------------------------------------------------------
-- EXECUTION: Critical 6 + Action Plans
-- ----------------------------------------------------------------------------

create table critical_six (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  objective_id       uuid references objectives (id) on delete set null,
  key_result_id      uuid references key_results (id) on delete set null,
  kpi_id             uuid references kpis (id) on delete set null,
  owner_id           uuid not null references users (id),
  team_id            uuid references teams (id) on delete set null,
  start_date         date,
  due_date           date,
  status             task_status not null default 'not_started',
  priority           priority_level not null default 'important',
  impact_score       smallint check (impact_score between 1 and 10),
  confidence_score   numeric(3,1),
  blocker            text,
  completion_criteria text,
  ai_next_action     text,
  is_today_focus     boolean not null default false,
  is_weekly_focus    boolean not null default false,
  focus_date         date,            -- the day it was marked today-focus (for history)
  completed_at       timestamptz,
  delay_reason       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references users (id),
  updated_by         uuid references users (id)
);

create table action_plans (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  objective_id    uuid references objectives (id) on delete set null,
  key_result_id   uuid references key_results (id) on delete set null,
  kpi_id          uuid references kpis (id) on delete set null,
  critical_six_id uuid references critical_six (id) on delete set null,
  owner_id        uuid references users (id),
  team_id         uuid references teams (id) on delete set null,
  start_date      date,
  due_date        date,
  status          task_status not null default 'not_started',
  priority        priority_level not null default 'medium',
  bucket          text,                          -- Planner-style bucket/column
  labels          text[] not null default '{}',
  checklist       jsonb not null default '[]'::jsonb,  -- [{id,text,done}]
  progress        numeric(5,2) not null default 0,     -- derived from checklist/status
  recurrence_rule text,                          -- RRULE string
  is_open_on_board boolean not null default true,
  external_id     text,                          -- id when synced from Planner/etc.
  data_source     text,                          -- origin system label
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references users (id),
  updated_by      uuid references users (id)
);

-- Multiple assignees per Action Plan (owner_id = primary).
create table action_plan_assignees (
  id             uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references action_plans (id) on delete cascade,
  user_id        uuid not null references users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references users (id),
  updated_by     uuid references users (id),
  unique (action_plan_id, user_id)
);

-- ----------------------------------------------------------------------------
-- CFR (Conversation · Feedback · Recognition)
-- ----------------------------------------------------------------------------

create table cfr_checkins (
  id                 uuid primary key default gen_random_uuid(),
  related_type       cfr_related_type not null,
  related_id         uuid not null,                 -- polymorphic FK (validated by trigger)
  user_id            uuid not null references users (id),
  team_id            uuid references teams (id) on delete set null,
  week_start_date    date not null,                 -- Monday of the reporting week
  progress_summary   text,
  completed_work     text,
  blockers           text,
  next_week_actions  text,
  support_needed     text,
  risk_level         risk_level not null default 'none',
  confidence_score   numeric(3,1),
  manager_feedback   text,
  manager_user_id    uuid references users (id),
  recognition_comment text,
  ai_summary         text,
  ai_risk_analysis   text,
  ai_next_action     text,
  ai_meta            jsonb not null default '{}'::jsonb,  -- structured AI scores
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references users (id),
  updated_by         uuid references users (id),
  unique (related_type, related_id, user_id, week_start_date)
);

-- ----------------------------------------------------------------------------
-- COLLABORATION: comments + attachments (polymorphic)
-- ----------------------------------------------------------------------------

create table comments (
  id           uuid primary key default gen_random_uuid(),
  related_type comment_related_type not null,
  related_id   uuid not null,
  user_id      uuid not null references users (id),
  body         text not null,
  mentions     uuid[] not null default '{}',     -- mentioned user ids
  parent_id    uuid references comments (id) on delete cascade,  -- threads
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references users (id),
  updated_by   uuid references users (id)
);

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  related_type attachment_related_type not null,
  related_id   uuid not null,
  file_name    text not null,
  storage_path text not null,                     -- Supabase Storage object path
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references users (id),
  updated_by   uuid references users (id)
);

-- ----------------------------------------------------------------------------
-- CRM (extension — modelled now, surfaced in UI at phase 3)
-- ----------------------------------------------------------------------------

create table crm_accounts (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text not null,
  country             text,
  market              text,
  account_owner_id    uuid references users (id),
  account_status      crm_account_status not null default 'prospect',
  account_grade       crm_account_grade,
  expected_revenue    numeric,
  actual_revenue      numeric,
  last_contact_date   date,
  next_followup_date  date,
  related_objective_id uuid references objectives (id) on delete set null,
  related_key_result_id uuid references key_results (id) on delete set null,
  memo                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references users (id),
  updated_by          uuid references users (id)
);

create table crm_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  opportunity_name      text not null,
  account_id            uuid not null references crm_accounts (id) on delete cascade,
  owner_id              uuid references users (id),
  stage                 crm_stage not null default 'lead',
  expected_revenue      numeric,
  probability           numeric(5,2),              -- 0..100
  expected_close_date   date,
  related_objective_id  uuid references objectives (id) on delete set null,
  related_key_result_id uuid references key_results (id) on delete set null,
  related_kpi_id        uuid references kpis (id) on delete set null,
  related_action_plan_id uuid references action_plans (id) on delete set null,
  next_action           text,
  risk_level            risk_level not null default 'none',
  memo                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references users (id),
  updated_by            uuid references users (id)
);

-- ----------------------------------------------------------------------------
-- AI, AUDIT, NOTIFICATIONS
-- ----------------------------------------------------------------------------

create table ai_insights (
  id            uuid primary key default gen_random_uuid(),
  insight_type  ai_insight_type not null,
  related_type  text,                              -- entity kind, nullable for global
  related_id    uuid,
  team_id       uuid references teams (id) on delete set null,
  user_id       uuid references users (id) on delete set null,  -- target audience
  title         text,
  summary       text,
  risk_level    risk_level,
  payload       jsonb not null default '{}'::jsonb, -- structured: scores, refs, actions
  model         text,                               -- e.g. 'claude-opus-4-8'
  is_dismissed  boolean not null default false,
  valid_until   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references users (id),
  updated_by    uuid references users (id)
);

-- Generic audit trail — "모든 변경사항은 activity log에 기록."
create table activity_logs (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,                        -- table name
  entity_id   uuid not null,
  action      text not null,                        -- insert | update | delete | custom
  actor_id    uuid references users (id),
  team_id     uuid references teams (id) on delete set null,
  changes     jsonb not null default '{}'::jsonb,   -- {field:{old,new}}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references users (id),
  updated_by  uuid references users (id)
);

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,  -- recipient
  type         notification_type not null,
  title        text not null,
  body         text,
  related_type text,
  related_id   uuid,
  is_read      boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references users (id),
  updated_by   uuid references users (id)
);

-- ----------------------------------------------------------------------------
-- INDEXES (hot paths)
-- ----------------------------------------------------------------------------
create index idx_team_members_user      on team_members (user_id);
create index idx_team_members_team      on team_members (team_id);
create index idx_team_access_user       on team_access (user_id);
create index idx_objectives_team        on objectives (team_id);
create index idx_objectives_parent      on objectives (parent_objective_id);
create index idx_objectives_owner       on objectives (owner_id);
create index idx_objectives_period      on objectives (year, quarter);
create index idx_objectives_status      on objectives (status);
create index idx_key_results_objective  on key_results (objective_id);
create index idx_key_results_owner      on key_results (owner_id);
create index idx_kpis_kr                on kpis (key_result_id);
create index idx_kpis_source            on kpis (data_source_id);
create index idx_kpi_history_kpi_time   on kpi_history (kpi_id, recorded_at desc);
create index idx_critical_six_owner     on critical_six (owner_id);
create index idx_critical_six_kr        on critical_six (key_result_id);
create index idx_critical_six_today     on critical_six (owner_id, is_today_focus) where is_today_focus;
create index idx_action_plans_kr        on action_plans (key_result_id);
create index idx_action_plans_owner     on action_plans (owner_id);
create index idx_action_plans_c6        on action_plans (critical_six_id);
create index idx_cfr_related            on cfr_checkins (related_type, related_id);
create index idx_cfr_user_week          on cfr_checkins (user_id, week_start_date desc);
create index idx_comments_related       on comments (related_type, related_id);
create index idx_attachments_related    on attachments (related_type, related_id);
create index idx_crm_opp_account        on crm_opportunities (account_id);
create index idx_crm_opp_stage          on crm_opportunities (stage);
create index idx_sync_logs_source       on data_sync_logs (data_source_id, started_at desc);
create index idx_ai_insights_target     on ai_insights (related_type, related_id);
create index idx_activity_entity        on activity_logs (entity_type, entity_id);
create index idx_notifications_user     on notifications (user_id, is_read);

-- ==================== supabase/migrations/0003_functions_triggers.sql ====================

-- =============================================================================
-- AI Execution OS — 0003_functions_triggers.sql
-- Automation: updated_at, audit logging, progress roll-up, KPI achievement,
-- and the Critical 6 overload guard.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function fn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Generic activity log. Attach to any audited table; records old→new diffs.
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: the audit log must never be blockable by the caller's RLS.
-- NOTE: operate on jsonb snapshots (to_jsonb), NOT on the NEW/OLD records — the
-- `->>` operator is only defined for json/jsonb, never for a row type.
create or replace function fn_log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_changes jsonb := '{}'::jsonb;
  v_team uuid;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  k text;
begin
  -- actor: prefer the row's updated_by, else the auth context
  v_actor := coalesce((v_row ->> 'updated_by')::uuid, auth.uid());
  begin
    v_team := (v_row ->> 'team_id')::uuid;   -- null when the table has no team_id
  exception when others then v_team := null;
  end;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if v_new -> k is distinct from v_old -> k and k <> 'updated_at' then
        v_changes := v_changes || jsonb_build_object(
          k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return new; end if;  -- nothing meaningful changed
  end if;

  insert into activity_logs (entity_type, entity_id, action, actor_id, team_id, changes)
  values (
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end),
    lower(tg_op),
    v_actor,
    v_team,
    case tg_op when 'UPDATE' then v_changes when 'INSERT' then v_new else v_old end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ----------------------------------------------------------------------------
-- KR progress + KPI achievement
-- ----------------------------------------------------------------------------
create or replace function fn_calc_kr_progress()
returns trigger language plpgsql as $$
declare base numeric; span numeric;
begin
  base := coalesce(new.baseline_value, 0);
  span := new.target_value - base;
  if new.target_value is null or span = 0 then
    new.progress := case when new.status = 'completed' then 100 else coalesce(new.progress,0) end;
  else
    new.progress := round(greatest(0, least(100,
      ((coalesce(new.current_value,0) - base) / span) * 100)), 2);
  end if;
  if new.progress >= 100 and new.status <> 'cancelled' then
    new.status := 'completed';
  end if;
  return new;
end $$;

create or replace function fn_calc_kpi_achievement()
returns trigger language plpgsql as $$
begin
  if new.target_value is not null and new.target_value <> 0 then
    new.achievement_rate := round((coalesce(new.current_value,0) / new.target_value) * 100, 2);
    new.status := case
      when new.current_value is null then 'no_data'
      when new.achievement_rate >= 100 then 'on_track'
      when new.achievement_rate >= 80  then 'at_risk'
      else 'off_track' end;
  else
    new.status := case when new.current_value is null then 'no_data' else new.status end;
  end if;
  return new;
end $$;

-- Roll objective.progress up from its key_results (simple average).
-- SECURITY DEFINER: a member updating their own KR must be able to refresh the
-- parent objective's progress even if RLS would not let them write that row.
create or replace function fn_rollup_objective_progress(p_objective_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avg numeric;
begin
  select round(avg(progress), 2) into v_avg
  from key_results where objective_id = p_objective_id;
  update objectives set progress = coalesce(v_avg, 0), updated_at = now()
  where id = p_objective_id;
end $$;

create or replace function fn_kr_after_change()
returns trigger language plpgsql as $$
begin
  perform fn_rollup_objective_progress(coalesce(new.objective_id, old.objective_id));
  return null;
end $$;

-- ----------------------------------------------------------------------------
-- Critical 6 overload guard: warn (via ai_insights + notification) when a user
-- has >6 active Critical 6 items. Items are NOT blocked — this is a nudge.
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: writes ai_insights + notifications regardless of caller RLS.
create or replace function fn_critical_six_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  select count(*) into v_count from critical_six
  where owner_id = new.owner_id
    and status in ('not_started','in_progress','at_risk','delayed');

  if v_count > 6 then
    insert into ai_insights (insight_type, related_type, related_id, user_id,
                             title, summary, risk_level, payload, model)
    values ('workload_warning', 'critical_six', new.id, new.owner_id,
            'Critical 6 초과',
            format('현재 활성 Critical 6가 %s개입니다. 6개 이하로 집중하세요.', v_count),
            'medium', jsonb_build_object('active_count', v_count), 'rule-engine');

    insert into notifications (user_id, type, title, body, related_type, related_id)
    values (new.owner_id, 'ai_alert', 'Critical 6가 너무 많습니다',
            format('활성 항목 %s개 — 핵심 6개에 집중하세요.', v_count),
            'critical_six', new.id);
  end if;
  return new;
end $$;

-- Validate the polymorphic CFR target actually exists.
create or replace function fn_validate_cfr_target()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exists boolean;
begin
  execute format('select exists(select 1 from %I where id = $1)',
    case new.related_type
      when 'objective' then 'objectives'
      when 'key_result' then 'key_results'
      when 'critical_six' then 'critical_six'
      when 'action_plan' then 'action_plans' end)
  into v_exists using new.related_id;
  if not v_exists then
    raise exception 'CFR related_id % not found in % table', new.related_id, new.related_type;
  end if;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- TRIGGER WIRING
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  -- updated_at on every audited table
  foreach t in array array[
    'users','teams','team_members','team_access','objectives','objective_owners',
    'key_results','key_result_owners','data_sources','data_sync_logs','kpis',
    'kpi_history','critical_six','action_plans','action_plan_assignees',
    'cfr_checkins','comments','attachments','crm_accounts','crm_opportunities',
    'ai_insights','activity_logs','notifications'
  ] loop
    execute format(
      'create trigger trg_touch_%1$s before update on %1$s
       for each row execute function fn_touch_updated_at()', t);
  end loop;

  -- activity logging on the meaningful business tables (skip logs/notifications)
  foreach t in array array[
    'users','teams','team_members','team_access','objectives','key_results',
    'kpis','critical_six','action_plans','cfr_checkins','crm_accounts',
    'crm_opportunities','data_sources'
  ] loop
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on %1$s
       for each row execute function fn_log_activity()', t);
  end loop;
end $$;

create trigger trg_kr_progress before insert or update on key_results
  for each row execute function fn_calc_kr_progress();
create trigger trg_kr_rollup after insert or update or delete on key_results
  for each row execute function fn_kr_after_change();
create trigger trg_kpi_achievement before insert or update on kpis
  for each row execute function fn_calc_kpi_achievement();
create trigger trg_c6_guard after insert on critical_six
  for each row execute function fn_critical_six_guard();
create trigger trg_cfr_validate before insert or update on cfr_checkins
  for each row execute function fn_validate_cfr_target();

-- ==================== supabase/migrations/0004_rls.sql ====================

-- =============================================================================
-- AI Execution OS — 0004_rls.sql
-- Row Level Security implementing the role model:
--   Admin     → everything
--   Executive → read-only across the whole company
--   Team Leader → manage own team(s); read other teams only with team_access
--   Member    → own records + read team context
-- Helper functions are SECURITY DEFINER to avoid recursive RLS on users/teams.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helper predicates
-- ----------------------------------------------------------------------------
create or replace function fn_my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid();
$$;

create or replace function fn_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from users where id = auth.uid()), false);
$$;

create or replace function fn_is_executive()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','executive') from users where id = auth.uid()), false);
$$;

-- team_ids the user is a member of
create or replace function fn_my_team_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select team_id from team_members where user_id = auth.uid();
$$;

-- team_ids the user has an explicit cross-team grant for (non-expired)
create or replace function fn_granted_team_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select team_id from team_access
  where user_id = auth.uid() and (expires_at is null or expires_at > now());
$$;

-- can the current user VIEW this team's data?
create or replace function fn_can_view_team(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select fn_is_executive()
      or p_team in (select fn_my_team_ids())
      or p_team in (select fn_granted_team_ids());
$$;

-- is the current user a leader of this team (or admin)?
create or replace function fn_is_team_leader(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select fn_is_admin()
      or exists (select 1 from team_members
                 where team_id = p_team and user_id = auth.uid() and team_role = 'leader');
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'users','teams','team_members','team_access','objectives','objective_owners',
    'key_results','key_result_owners','data_sources','data_sync_logs','kpis',
    'kpi_history','critical_six','action_plans','action_plan_assignees',
    'cfr_checkins','comments','attachments','crm_accounts','crm_opportunities',
    'ai_insights','activity_logs','notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------------------
create policy users_select on users for select using (true);             -- directory is readable
create policy users_self_update on users for update using (id = auth.uid());
create policy users_admin_all on users for all using (fn_is_admin()) with check (fn_is_admin());

-- ----------------------------------------------------------------------------
-- TEAMS / MEMBERSHIP / ACCESS  (admin manages; everyone reads)
-- ----------------------------------------------------------------------------
create policy teams_select on teams for select using (true);
create policy teams_admin on teams for all using (fn_is_admin()) with check (fn_is_admin());

create policy tm_select on team_members for select using (true);
create policy tm_admin on team_members for all using (fn_is_admin()) with check (fn_is_admin());
-- a team leader may add/remove members of their own team
create policy tm_leader on team_members for all
  using (fn_is_team_leader(team_id)) with check (fn_is_team_leader(team_id));

create policy ta_select on team_access for select
  using (user_id = auth.uid() or fn_is_admin());
create policy ta_admin on team_access for all using (fn_is_admin()) with check (fn_is_admin());

-- ----------------------------------------------------------------------------
-- OBJECTIVES
--   read: company-level visible to all; team/personal gated by team visibility
--   write: admin, the owner, a co-owner, or a leader of the objective's team
-- ----------------------------------------------------------------------------
create policy obj_select on objectives for select using (
  fn_is_executive()
  or level = 'company'
  or owner_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id))
  or exists (select 1 from objective_owners o where o.objective_id = id and o.user_id = auth.uid())
);
create policy obj_write on objectives for all using (
  fn_is_admin()
  or owner_id = auth.uid()
  or (team_id is not null and fn_is_team_leader(team_id))
  or exists (select 1 from objective_owners o where o.objective_id = id and o.user_id = auth.uid())
) with check (
  fn_is_admin()
  or owner_id = auth.uid()
  or (team_id is not null and fn_is_team_leader(team_id))
);

create policy obj_owners_select on objective_owners for select using (true);
create policy obj_owners_write on objective_owners for all using (
  fn_is_admin() or exists (
    select 1 from objectives ob where ob.id = objective_id
    and (ob.owner_id = auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id))))
) with check (fn_is_admin() or exists (
    select 1 from objectives ob where ob.id = objective_id
    and (ob.owner_id = auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id)))));

-- ----------------------------------------------------------------------------
-- KEY RESULTS (inherit visibility/writability from parent objective)
-- ----------------------------------------------------------------------------
create policy kr_select on key_results for select using (
  exists (select 1 from objectives ob where ob.id = objective_id) and (
    fn_is_executive()
    or owner_id = auth.uid()
    or exists (select 1 from objectives ob where ob.id = objective_id
               and (ob.level='company' or ob.owner_id=auth.uid()
                    or (ob.team_id is not null and fn_can_view_team(ob.team_id))))
  )
);
create policy kr_write on key_results for all using (
  fn_is_admin() or owner_id = auth.uid()
  or exists (select 1 from objectives ob where ob.id = objective_id
             and (ob.owner_id=auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id))))
) with check (
  fn_is_admin() or owner_id = auth.uid()
  or exists (select 1 from objectives ob where ob.id = objective_id
             and (ob.owner_id=auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id))))
);
create policy kro_select on key_result_owners for select using (true);
create policy kro_write on key_result_owners for all using (fn_is_admin()
  or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()))
  with check (fn_is_admin()
  or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- KPIs / history  (read by team visibility; write by owner/leader/admin)
-- ----------------------------------------------------------------------------
create policy kpi_select on kpis for select using (
  fn_is_executive() or owner_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id))
);
create policy kpi_write on kpis for all using (
  fn_is_admin() or owner_id = auth.uid() or (team_id is not null and fn_is_team_leader(team_id))
) with check (
  fn_is_admin() or owner_id = auth.uid() or (team_id is not null and fn_is_team_leader(team_id))
);
create policy kpi_hist_select on kpi_history for select using (
  exists (select 1 from kpis k where k.id = kpi_id and (
    fn_is_executive() or k.owner_id = auth.uid()
    or (k.team_id is not null and fn_can_view_team(k.team_id)))));
create policy kpi_hist_write on kpi_history for all using (
  fn_is_admin() or exists (select 1 from kpis k where k.id = kpi_id
    and (k.owner_id = auth.uid() or (k.team_id is not null and fn_is_team_leader(k.team_id)))))
  with check (true);

-- ----------------------------------------------------------------------------
-- CRITICAL 6 / ACTION PLANS  (owner + assignees + team visibility)
-- ----------------------------------------------------------------------------
create policy c6_select on critical_six for select using (
  fn_is_executive() or owner_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id))
);
create policy c6_write on critical_six for all using (
  fn_is_admin() or owner_id = auth.uid() or (team_id is not null and fn_is_team_leader(team_id))
) with check (
  fn_is_admin() or owner_id = auth.uid() or (team_id is not null and fn_is_team_leader(team_id))
);

create policy ap_select on action_plans for select using (
  fn_is_executive() or owner_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id))
  or exists (select 1 from action_plan_assignees a where a.action_plan_id = id and a.user_id = auth.uid())
);
create policy ap_write on action_plans for all using (
  fn_is_admin() or owner_id = auth.uid()
  or (team_id is not null and fn_is_team_leader(team_id))
  or exists (select 1 from action_plan_assignees a where a.action_plan_id = id and a.user_id = auth.uid())
) with check (
  fn_is_admin() or owner_id = auth.uid() or (team_id is not null and fn_is_team_leader(team_id))
);
create policy apa_select on action_plan_assignees for select using (true);
create policy apa_write on action_plan_assignees for all using (
  fn_is_admin() or exists (select 1 from action_plans p where p.id = action_plan_id
    and (p.owner_id = auth.uid() or (p.team_id is not null and fn_is_team_leader(p.team_id)))))
  with check (true);

-- ----------------------------------------------------------------------------
-- CFR  (author writes own; manager/leader of the team can add feedback)
-- ----------------------------------------------------------------------------
create policy cfr_select on cfr_checkins for select using (
  fn_is_executive() or user_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id))
);
create policy cfr_insert on cfr_checkins for insert with check (user_id = auth.uid() or fn_is_admin());
create policy cfr_update on cfr_checkins for update using (
  user_id = auth.uid() or fn_is_admin() or (team_id is not null and fn_is_team_leader(team_id))
);
create policy cfr_delete on cfr_checkins for delete using (user_id = auth.uid() or fn_is_admin());

-- ----------------------------------------------------------------------------
-- COMMENTS / ATTACHMENTS  (author or admin writes; all authenticated read)
-- ----------------------------------------------------------------------------
create policy cmt_select on comments for select using (true);
create policy cmt_write  on comments for all using (user_id = auth.uid() or fn_is_admin())
  with check (user_id = auth.uid() or fn_is_admin());
create policy att_select on attachments for select using (true);
create policy att_write  on attachments for all using (created_by = auth.uid() or fn_is_admin())
  with check (created_by = auth.uid() or fn_is_admin());

-- ----------------------------------------------------------------------------
-- CRM  (account owner + admin write; team-visible read)
-- ----------------------------------------------------------------------------
create policy crm_acc_select on crm_accounts for select using (
  fn_is_executive() or account_owner_id = auth.uid());
create policy crm_acc_write on crm_accounts for all using (
  fn_is_admin() or account_owner_id = auth.uid())
  with check (fn_is_admin() or account_owner_id = auth.uid());
create policy crm_opp_select on crm_opportunities for select using (
  fn_is_executive() or owner_id = auth.uid()
  or exists (select 1 from crm_accounts a where a.id = account_id and a.account_owner_id = auth.uid()));
create policy crm_opp_write on crm_opportunities for all using (
  fn_is_admin() or owner_id = auth.uid())
  with check (fn_is_admin() or owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- DATA SOURCES  (admin only — "데이터 소스 관리" is an Admin power)
-- ----------------------------------------------------------------------------
create policy ds_select on data_sources for select using (fn_is_admin() or owner_id = auth.uid());
create policy ds_admin on data_sources for all using (fn_is_admin()) with check (fn_is_admin());
create policy dsl_select on data_sync_logs for select using (fn_is_admin());
create policy dsl_admin on data_sync_logs for all using (fn_is_admin()) with check (fn_is_admin());

-- ----------------------------------------------------------------------------
-- AI INSIGHTS / ACTIVITY / NOTIFICATIONS
-- ----------------------------------------------------------------------------
create policy ai_select on ai_insights for select using (
  fn_is_executive() or user_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id)));
create policy ai_write on ai_insights for all using (fn_is_admin()) with check (true);
-- insights are written by service-role/triggers; users may dismiss their own
create policy ai_dismiss on ai_insights for update using (user_id = auth.uid());

create policy act_select on activity_logs for select using (
  fn_is_executive() or actor_id = auth.uid()
  or (team_id is not null and fn_can_view_team(team_id)));
-- activity_logs are insert-only via triggers (service role); no user writes.

create policy notif_select on notifications for select using (user_id = auth.uid());
create policy notif_update on notifications for update using (user_id = auth.uid());
create policy notif_admin on notifications for all using (fn_is_admin()) with check (true);

-- ==================== supabase/migrations/0005_views.sql ====================

-- =============================================================================
-- AI Execution OS — 0005_views.sql
-- Read models for dashboards. Views inherit RLS from their base tables.
-- =============================================================================

-- Action Plans NOT linked to any OKR/KPI/Critical6 — the "orphan" list the
-- product must surface to push everything toward alignment.
create or replace view v_unconnected_action_plans as
select *
from action_plans
where objective_id is null
  and key_result_id is null
  and kpi_id is null
  and critical_six_id is null
  and status <> 'cancelled';

-- OKRs past due and not completed.
create or replace view v_delayed_objectives as
select id, title, level, team_id, owner_id, due_date, status, progress,
       (current_date - due_date) as days_overdue
from objectives
where due_date is not null and due_date < current_date
  and status not in ('completed','cancelled');

-- At-risk / delayed OKRs (explicit status OR low progress near deadline).
create or replace view v_at_risk_okr as
select 'objective'::text as kind, id, title, team_id, owner_id, status, progress, due_date
from objectives
where status in ('at_risk','delayed')
   or (due_date is not null and due_date < current_date + interval '7 days'
       and progress < 70 and status not in ('completed','cancelled'))
union all
select 'key_result', id, title, null, owner_id, status, progress, due_date
from key_results
where status in ('at_risk','delayed')
   or (due_date is not null and due_date < current_date + interval '7 days'
       and progress < 70 and status not in ('completed','cancelled'));

-- Weekly CFR submission rate per team (denominator = active members).
create or replace view v_cfr_submission_rate as
select t.id as team_id, t.name as team_name, c.week_start_date,
       count(distinct c.user_id)                       as submitted,
       count(distinct tm.user_id)                       as expected,
       round(100.0 * count(distinct c.user_id)
             / nullif(count(distinct tm.user_id),0), 1) as submission_pct
from teams t
join team_members tm on tm.team_id = t.id
left join cfr_checkins c on c.team_id = t.id and c.user_id = tm.user_id
group by t.id, t.name, c.week_start_date;

-- Today's Critical 6 per user (drives the My Daily screen).
create or replace view v_today_critical_six as
select c.*, kr.title as kr_title, o.title as objective_title
from critical_six c
left join key_results kr on kr.id = c.key_result_id
left join objectives  o on o.id = c.objective_id
where c.is_today_focus
  and c.status not in ('completed','cancelled');

-- CRM pipeline value vs actual revenue per owner (phase-3 chart).
create or replace view v_crm_pipeline_vs_actual as
select a.account_owner_id as owner_id,
       sum(o.expected_revenue * coalesce(o.probability,0)/100.0) as weighted_pipeline,
       sum(a.actual_revenue)                                     as actual_revenue
from crm_accounts a
left join crm_opportunities o on o.account_id = a.id and o.stage not in ('lost','on_hold')
group by a.account_owner_id;

-- ==================== supabase/migrations/0006_auth_profile.sql ====================

-- =============================================================================
-- AI Execution OS — 0006_auth_profile.sql
-- Auto-provision a public.users profile whenever someone signs up via Supabase
-- Auth, so a team can self-onboard with NO manual SQL per person.
-- The very first account becomes 'admin'; everyone after is 'member'
-- (an admin can promote others later).
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing int;
begin
  select count(*) into v_existing from public.users;
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when v_existing = 0 then 'admin' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
