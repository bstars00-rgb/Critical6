# AI Execution OS — MVP-1 (Authoritative Spec)

> Viva-Goals-inspired execution OS for internal company use. MVP-1 = the
> **weekly/daily loop a team actually uses**, on the existing Supabase + GitHub
> Pages stack. Build top-to-bottom; everything else is a later phase.

## 1. North star
OKR을 매일 실행(Critical 6)·매주 점검(CFR)·체크인으로 굴리고, 진행률이 위로
유기적으로 롤업되며, 위험을 자동으로 표시한다.

## 2. MVP-1 scope (in)
1. **Auth + Org** — Supabase Auth, `users / teams / team_members`, RBAC via RLS.
2. **OKR core (Viva style)**
   - Objective → Key Result, 정렬(회사→팀→개인, 회사는 대시보드 방향성).
   - **Check-in**: KR 진행률·신뢰도·메모 기록 → KR% → 상위 Objective% 자동 롤업.
   - Health Indicators (주의/위험) — 규칙 기반 (`src/lib/okrHealth.ts`).
   - 뷰: 트리(Oboard 스타일) + 연간 타임라인(간트) + 상세(예상 vs 실제).
3. **Critical 6** — 매일 ≤6, KR 연결, Action Plan에서 생성.
4. **CFR** — 주간 체크인(진행/blocker/다음주/리스크) + 팀장 피드백.
5. **Action Plan** — KR 하위 작업 보드(상태 칸반, 체크리스트, 담당자).
6. **KPI (manual)** — KR 연결 수치 지표 수동 입력/추적 + 추이.
7. **Dashboard** — 회사 방향성 + 팀 진행률 + 위험 KR + 주간 핵심.

## 3. Out (later phases)
- **Phase 2** — KPI 자동연동(회사 DB/CSV/Sheet, Edge Functions), 알림/자동화,
  AI 실행관리(mock → Edge Function로 Claude/OpenAI).
- **Phase 3** — CRM 확장(고객사/파이프라인 ↔ 매출 KR).
- **Phase 4** — 회사 DB 실시간 연동, 예측/시뮬레이션.

## 4. Architecture
- **Front**: Vite + React + TS + Tailwind. GitHub Pages(HashRouter). GitHub
  Actions 빌드·배포(`VITE_SUPABASE_URL/ANON_KEY` repo secret, 404.html fallback).
- **Back**: Supabase Postgres + Auth + **RLS** + Storage + Realtime; 이후 Edge
  Functions(AI/DB/Webhook). 모든 쓰기는 트리거로 감사/롤업.
- **Code**: `services/`(Supabase CRUD) · `pages/` · `components/` · `lib/` ·
  `ai/`(교체형) · `i18n`(EN/KO) · 다크모드.

## 5. Core data model (MVP-1 tables)
`users · teams · team_members · objectives · key_results · kr_quarters ·
check_ins · cfr_checkins · critical_six · action_plans · kpis · kpi_history ·
ai_insights · activity_logs · notifications`
- 롤업: `check_ins`→`key_results.current_value`→KR%→Objective% (트리거).
- Health: 시작/기한·예상치·소유자·KR수 규칙.

## 6. Build order (status)
| # | 항목 | 상태 |
|---|---|---|
| 1 | Auth/Org/RLS | ✅ live |
| 2 | OKR tree/detail/timeline/health | ✅ live |
| 3 | **Check-in (KR 진행 기록 + 자동 롤업)** | ⏳ **MVP-1 마지막 핵심 — 다음 작업** |
| 4 | Critical 6 (daily) | ✅ live |
| 5 | CFR (weekly) | ✅ live |
| 6 | Action Plan board | ✅ live |
| 7 | KPI manual + 추이 | ✅ live |
| 8 | Dashboard(방향성/팀/위험) | ✅ live |

## 7. "Done" criteria (MVP-1)
- 한 팀이 한 분기 동안 OKR을 **체크인으로 굴린다**: 매주 KR 체크인 → 진행률·상태·
  Health가 자동 갱신 → 대시보드/트리에 반영.
- 매일 Critical 6, 매주 CFR 작성률이 유지된다.
- 위험 KR이 분기말이 아니라 **그 주에** 보인다.
