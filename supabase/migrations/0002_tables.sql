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
