-- HOTFIX — run once in Supabase SQL Editor to fix signup / all writes.
-- Replaces fn_log_activity so it operates on jsonb snapshots instead of using
-- `->>` on a row type (which errors and caused "Database error saving new user").
-- The existing triggers already point at this function; no trigger changes needed.

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
  v_actor := coalesce((v_row ->> 'updated_by')::uuid, auth.uid());
  begin
    v_team := (v_row ->> 'team_id')::uuid;
  exception when others then v_team := null;
  end;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if v_new -> k is distinct from v_old -> k and k <> 'updated_at' then
        v_changes := v_changes || jsonb_build_object(
          k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then return new; end if;
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
