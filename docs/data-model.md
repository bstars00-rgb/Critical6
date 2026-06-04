# Data Model — AI Execution OS

## 1. The alignment spine

Everything links **up** to a goal. No orphan execution.

```
Company Objective        (objectives.level = company)
  └─ Team Objective      (level = team,     parent_objective_id → company)
       └─ Personal Objective (level = personal, parent_objective_id → team)
            └─ Key Result        (key_results.objective_id)
                 ├─ KPI           (kpis.key_result_id)            ── data_sources
                 ├─ Critical 6    (critical_six.key_result_id)
                 │     └─ Action Plan (action_plans.critical_six_id)
                 └─ CFR Check-in  (cfr_checkins → related_type/related_id)
```

`parent_objective_id` is a self-reference on `objectives`, so company→team→personal
is one recursive tree. KPIs/Critical 6/Action Plans can attach at the Objective,
KR, or KPI level — whichever is most specific.

## 2. The 17 entities + supporting tables

| # | Table | Role |
|---|---|---|
| 1 | `users` | identity + system role (1:1 with auth.users) |
| 2 | `teams` | org units, self-referencing tree |
| 3 | `team_members` | **multi-team** membership + per-team role |
| 4 | `objectives` | company/team/personal goals |
| 5 | `key_results` | measurable outcomes, auto progress |
| 6 | `kpis` | continuous metrics, linked to a data source |
| 7 | `critical_six` | daily/weekly focus execution (≤6 guard) |
| 8 | `action_plans` | Planner-style tasks |
| 9 | `cfr_checkins` | weekly Conversation·Feedback·Recognition |
| 10 | `comments` | polymorphic discussion |
| 11 | `attachments` | polymorphic files (Supabase Storage) |
| 12 | `crm_accounts` | customer companies (phase 3) |
| 13 | `crm_opportunities` | deals/pipeline (phase 3) |
| 14 | `data_sources` | abstracted external connections |
| 15 | `ai_insights` | AI/rule outputs (risk, priority, summary) |
| 16 | `activity_logs` | full audit trail |
| 17 | `notifications` | per-user inbox |
| + | `team_access` | cross-team view grants |
| + | `objective_owners`, `key_result_owners`, `action_plan_assignees` | **multi-owner** joins |
| + | `kpi_history` | KPI time series |
| + | `data_sync_logs` | per-sync run records |

## 3. Worked example (the brief's SEA case)

| Layer | Row |
|---|---|
| Company Objective | "2026 Southeast Asia B2B Channel Growth" (level=company, year=2026) |
| Team Objective | "GST Channel Expansion" (level=team, parent→company, team=GST) |
| Key Result | "KR1 Active Channel 1000" (target_value=1000, unit=channels) |
| KPI | "Active Channel Count" (metric_type=active_channel_count, source=booking_db) |
| Critical 6 | "Ctrip Rate Plan Issue 해결" (key_result_id→KR1, is_weekly_focus=true) |
| Action Plan | "Ctrip affected hotel list 확인" (critical_six_id→above) |
| CFR | weekly check-in (related_type=key_result, related_id=KR1) |
| CRM (p3) | Accounts: Agoda, Traveloka, Ctrip, Dida → linked via related_key_result_id |

As `kpi.current_value` rises (synced from `booking_db`), the trigger recomputes
`achievement_rate`; updating KR `current_value` recomputes KR `progress`, which
rolls up to the Objective `progress` automatically.

## 4. Automation built into the DB (triggers)

- `updated_at` auto-touch on every table.
- `activity_logs` diff capture on all business tables.
- KR `progress` from baseline/current/target; auto-complete at 100%.
- Objective `progress` = avg of child KRs (roll-up on KR change).
- KPI `achievement_rate` + `status` from current/target.
- Critical 6 overload → `ai_insights` + `notification` when active count > 6.
- CFR polymorphic target validation.

## 5. Derived views (dashboards)

`v_unconnected_action_plans`, `v_delayed_objectives`, `v_at_risk_okr`,
`v_cfr_submission_rate`, `v_today_critical_six`, `v_crm_pipeline_vs_actual`.
