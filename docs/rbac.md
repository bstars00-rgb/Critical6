# RBAC — AI Execution OS

## 1. Roles

Two layers of role:

- **System role** (`users.role`) — one per user: `admin`, `executive`, `team_leader`, `member`.
  Defines global capability ceiling.
- **Team role** (`team_members.team_role`) — per team: `leader`, `member`, `viewer`.
  A user can be **leader of Team A and member of Team B** at the same time (multi-team).

A third construct, **`team_access`**, grants a user cross-team visibility beyond
their memberships — this is how "팀장은 권한이 있으면 다른 팀도 조회 가능" works
without making them a member.

## 2. Permission matrix

| Capability | Admin | Executive | Team Leader | Member |
|---|:--:|:--:|:--:|:--:|
| Manage users / roles | ✅ | — | — | — |
| Manage teams & membership | ✅ | — | own team | — |
| Manage data sources / sync | ✅ | — | — | — |
| Manage AI settings | ✅ | — | — | — |
| View **all** company OKR | ✅ | ✅ | own + granted | own + team |
| View team OKR progress | ✅ | ✅ (all) | own team | own team |
| View core KPIs | ✅ | ✅ (all) | own team | own team |
| View at-risk KR | ✅ | ✅ (all) | own team | own |
| AI Executive Summary | ✅ | ✅ | team-scoped | — |
| Create/edit team OKR | ✅ | — | own team | — |
| Create/edit personal OKR | ✅ | — | own/team members | own |
| View team members' Action Plans | ✅ | read | own team | own |
| Write CFR feedback (manager) | ✅ | — | own team | — |
| Write own CFR | ✅ | ✅ | ✅ | ✅ |
| Manage own Action Plan / Critical 6 | ✅ | ✅ | ✅ | ✅ |
| View other team (with grant) | ✅ | n/a (all) | ✅ if `team_access` | ✅ if `team_access` |

Legend: ✅ full · "own team" = teams where the user is a member/leader · "all" =
entire company · "—" = no.

## 3. How it maps to the DB / RLS

Enforced in Postgres RLS (`0004_rls.sql`) via SECURITY DEFINER helpers:

| Helper | Meaning |
|---|---|
| `fn_is_admin()` | system role = admin |
| `fn_is_executive()` | role ∈ {admin, executive} → company-wide read |
| `fn_my_team_ids()` | teams the user belongs to |
| `fn_granted_team_ids()` | teams via non-expired `team_access` |
| `fn_can_view_team(t)` | executive OR member OR granted |
| `fn_is_team_leader(t)` | admin OR `team_members.team_role='leader'` for t |

Read pattern (e.g. objectives): visible if executive, OR company-level, OR you
own it / co-own it, OR you can view its team.
Write pattern: admin, OR (co-)owner, OR a leader of the objective's team.

## 4. Multi-owner & multi-assignee

- Objectives → primary `owner_id` + `objective_owners` (co-owners).
- Key Results → primary `owner_id` + `key_result_owners`.
- Action Plans → primary `owner_id` + `action_plan_assignees`.
Any owner/assignee gets write access to that record via RLS.

## 5. Audit

Every business-table change is captured in `activity_logs` by the
`fn_log_activity()` trigger (old→new field diffs, actor, team). This satisfies
"모든 변경사항은 activity log에 기록." Logs are insert-only; readable by the
actor, the team (via visibility), and executives/admin.

## 6. Notes / hardening for prod

- Insight/notification/log inserts run under the **service role** (bypasses RLS)
  or from `SECURITY DEFINER` triggers, so the `with check (true)` policies are
  not user-reachable write paths.
- Consider a periodic job to expire `team_access` grants and to recompute
  executive summaries.
- `connection_config` must reference a secret in Supabase Vault, never hold raw
  credentials.
