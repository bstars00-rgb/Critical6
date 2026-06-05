-- =============================================================================
-- AI Execution OS — 0007_fix_rls_recursion.sql
-- Fix 42P17 infinite recursion. The owner/assignee junction tables had FOR ALL
-- write policies whose USING/CHECK queried the PARENT table. FOR ALL also covers
-- SELECT, and the parent's own SELECT policy queries the junction — so reading
-- objectives/key_results/action_plans recursed through the junction and back.
-- Fix: scope the junction write policies to INSERT/UPDATE/DELETE only. SELECT on
-- the junctions stays open via the existing *_select (using true) policies, which
-- do NOT touch the parent — breaking the cycle.
-- =============================================================================

-- objective_owners ↔ objectives
drop policy if exists obj_owners_write on objective_owners;
create policy obj_owners_ins on objective_owners for insert with check (
  fn_is_admin() or exists (select 1 from objectives ob where ob.id = objective_id
    and (ob.owner_id = auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id)))));
create policy obj_owners_upd on objective_owners for update using (
  fn_is_admin() or exists (select 1 from objectives ob where ob.id = objective_id
    and (ob.owner_id = auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id)))));
create policy obj_owners_del on objective_owners for delete using (
  fn_is_admin() or exists (select 1 from objectives ob where ob.id = objective_id
    and (ob.owner_id = auth.uid() or (ob.team_id is not null and fn_is_team_leader(ob.team_id)))));

-- key_result_owners ↔ key_results
drop policy if exists kro_write on key_result_owners;
create policy kro_ins on key_result_owners for insert with check (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));
create policy kro_upd on key_result_owners for update using (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));
create policy kro_del on key_result_owners for delete using (
  fn_is_admin() or exists (select 1 from key_results k where k.id = key_result_id and k.owner_id = auth.uid()));

-- action_plan_assignees ↔ action_plans
drop policy if exists apa_write on action_plan_assignees;
create policy apa_ins on action_plan_assignees for insert with check (
  fn_is_admin() or exists (select 1 from action_plans p where p.id = action_plan_id
    and (p.owner_id = auth.uid() or (p.team_id is not null and fn_is_team_leader(p.team_id)))));
create policy apa_upd on action_plan_assignees for update using (
  fn_is_admin() or exists (select 1 from action_plans p where p.id = action_plan_id
    and (p.owner_id = auth.uid() or (p.team_id is not null and fn_is_team_leader(p.team_id)))));
create policy apa_del on action_plan_assignees for delete using (
  fn_is_admin() or exists (select 1 from action_plans p where p.id = action_plan_id
    and (p.owner_id = auth.uid() or (p.team_id is not null and fn_is_team_leader(p.team_id)))));
