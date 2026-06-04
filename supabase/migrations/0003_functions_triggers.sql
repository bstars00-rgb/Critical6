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
