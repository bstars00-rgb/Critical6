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
