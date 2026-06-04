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
