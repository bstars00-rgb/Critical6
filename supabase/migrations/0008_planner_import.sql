-- =============================================================================
-- AI Execution OS — 0008_planner_import.sql
-- Schema enhancements to import Microsoft Teams Planner exports (OKR / Action
-- Plan / Critical 6) and to represent team members who have NOT signed up yet.
-- =============================================================================

-- People roster: a team member known by name/email who may not (yet) have an
-- AEO login. `user_id` links to the auth-backed users row once they sign up.
create table if not exists people (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text unique,
  planner_user_id text unique,
  team_id         uuid references teams (id) on delete set null,
  user_id         uuid references users (id) on delete set null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references users (id),
  updated_by      uuid references users (id)
);
alter table people enable row level security;
drop policy if exists people_select on people;
drop policy if exists people_admin on people;
create policy people_select on people for select using (true);
create policy people_admin  on people for all using (fn_is_admin()) with check (fn_is_admin());

-- Traceability + idempotent re-import from external tools.
alter table objectives   add column if not exists external_id text;
alter table objectives   add column if not exists external_source text;
alter table key_results  add column if not exists external_id text;
alter table key_results  add column if not exists external_source text;
alter table critical_six add column if not exists external_id text;
alter table critical_six add column if not exists external_source text;
alter table action_plans add column if not exists external_source text;  -- already has external_id

-- Preserve Planner assignee display names (people may not be auth users yet).
alter table action_plans add column if not exists external_assignees text[] not null default '{}';
alter table critical_six add column if not exists external_assignees text[] not null default '{}';

-- Imported Critical 6 history may have no AEO owner.
alter table critical_six alter column owner_id drop not null;

-- Wire the standard triggers onto people.
drop trigger if exists trg_touch_people on people;
drop trigger if exists trg_audit_people on people;
create trigger trg_touch_people before update on people
  for each row execute function fn_touch_updated_at();
create trigger trg_audit_people after insert or update or delete on people
  for each row execute function fn_log_activity();
