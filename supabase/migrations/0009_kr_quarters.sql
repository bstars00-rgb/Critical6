-- =============================================================================
-- AI Execution OS — 0009_kr_quarters.sql
-- Quarterly breakdown of a Key Result: enter target + actual per Q1..Q4.
-- The KR's own target_value/current_value mirror the CURRENT calendar quarter
-- so the existing KR%→Objective% roll-up keeps working.
-- =============================================================================

create table if not exists kr_quarters (
  id            uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references key_results (id) on delete cascade,
  year          smallint not null,
  quarter       smallint not null check (quarter between 1 and 4),
  target_value  numeric,
  current_value numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references users (id),
  updated_by    uuid references users (id),
  unique (key_result_id, year, quarter)
);

alter table kr_quarters enable row level security;
drop policy if exists krq_select on kr_quarters;
drop policy if exists krq_ins on kr_quarters;
drop policy if exists krq_upd on kr_quarters;
drop policy if exists krq_del on kr_quarters;
create policy krq_select on kr_quarters for select using (true);
-- command-specific writes (avoid FOR ALL touching key_results during SELECT)
create policy krq_ins on kr_quarters for insert with check (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));
create policy krq_upd on kr_quarters for update using (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));
create policy krq_del on kr_quarters for delete using (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));

drop trigger if exists trg_touch_kr_quarters on kr_quarters;
create trigger trg_touch_kr_quarters before update on kr_quarters
  for each row execute function fn_touch_updated_at();

create index if not exists idx_kr_quarters_kr on kr_quarters (key_result_id, year, quarter);
