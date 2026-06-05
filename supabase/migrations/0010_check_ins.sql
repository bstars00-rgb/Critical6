-- =============================================================================
-- AI Execution OS — 0010_check_ins.sql
-- Viva-style check-ins: a recorded update of a Key Result's progress (value +
-- status + confidence + note). Inserting a check-in mirrors the value/status
-- onto the KR, so KR% and parent Objective% auto-roll-up (existing triggers).
-- =============================================================================

create table if not exists check_ins (
  id            uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references key_results (id) on delete cascade,
  user_id       uuid references users (id),
  value         numeric,            -- reported current_value
  status        okr_status,         -- reported status
  confidence    numeric(3,1),       -- 0..10
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references users (id),
  updated_by    uuid references users (id)
);

alter table check_ins enable row level security;
drop policy if exists ci_select on check_ins;
drop policy if exists ci_ins on check_ins;
drop policy if exists ci_mod on check_ins;
create policy ci_select on check_ins for select using (true);
create policy ci_ins on check_ins for insert with check (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()) or user_id = auth.uid());
create policy ci_mod on check_ins for all using (fn_is_admin() or user_id = auth.uid())
  with check (fn_is_admin() or user_id = auth.uid());

drop trigger if exists trg_touch_check_ins on check_ins;
create trigger trg_touch_check_ins before update on check_ins
  for each row execute function fn_touch_updated_at();

-- Apply a check-in to its KR (SECURITY DEFINER so it isn't blocked by RLS).
create or replace function fn_apply_checkin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update key_results set
    current_value    = coalesce(new.value, current_value),
    status           = coalesce(new.status, status),
    confidence_score = coalesce(new.confidence, confidence_score),
    updated_by       = coalesce(new.created_by, updated_by)
  where id = new.key_result_id;
  return new;
end $$;

drop trigger if exists trg_apply_checkin on check_ins;
create trigger trg_apply_checkin after insert on check_ins
  for each row execute function fn_apply_checkin();

create index if not exists idx_check_ins_kr on check_ins (key_result_id, created_at desc);
