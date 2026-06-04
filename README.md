# AI Execution OS

> OKR을 매일 실행 가능한 Critical 6, 주간 CFR, KPI, CRM 데이터와 연결하는
> AI 기반 성과관리 시스템.

회사 내부용 실행관리 시스템. OKR + Critical 6 + CFR + KPI + (확장) CRM 을 하나의
정렬된 데이터 모델 위에서 운영하고, AI가 위험·우선순위·다음 액션을 진단한다.

## Stack

Vite + React + TypeScript + Tailwind · Supabase (Postgres/Auth/Storage) ·
TanStack Query · Zustand · Recharts · swappable AI service (mock → Claude/OpenAI).

## Status — MVP Phase 1 implemented

| Layer | State |
|---|---|
| Database schema (Supabase Postgres) | ✅ `supabase/migrations/0001–0005` |
| RBAC + RLS (4 roles) | ✅ |
| Triggers (progress roll-up, audit, C6 guard) | ✅ |
| Data-source abstraction (adapter pattern) | ✅ designed — `docs/data-integration.md` |
| Auth + app shell + routing | ✅ |
| OKR (Tree/Detail, CRUD, AI quality check) | ✅ |
| Critical 6 (today/week, ≤6 guard) | ✅ |
| Action Board (kanban, orphan detection) | ✅ |
| CFR weekly check-in (+ AI analysis) | ✅ |
| KPI (manual update, CSV import) | ✅ |
| Dashboard / My Day / Charts / AI Insight | ✅ |
| Team / Executive / CRM / Calendar | ⚙️ functional stubs (phase 2–3) |
| AI service | ✅ mock provider (rule-based, no key needed) |

## Layout

```
supabase/migrations/  0001_enums … 0005_views   +  seed.sql
docs/                 rbac.md · data-model.md · data-integration.md
src/
  ai/        aiService.ts (interface) · mockProvider.ts · prompts.ts
  services/  crud.ts + objectives/keyResults/criticalSix/actionPlans/cfr/kpis/...
  pages/     Dashboard · MyDay · okr/* · CriticalSix · ActionBoard · Cfr · Kpi · ...
```

## Live prototype (GitHub Pages)

A **demo build** is published to GitHub Pages — no backend needed. When no
Supabase env is set (or `VITE_DEMO=true`), the app uses an in-memory mock client
(`src/lib/demo/`) seeded with the SEA sample data, so login, CRUD, charts and the
AI coach all work in-browser. Writes persist for the session only.

- **URL:** https://bstars00-rgb.github.io/Critical6/
- **Login:** any seed email (e.g. `admin@company.com`) — password is ignored in demo.
- Deployed automatically on push to `main` via `.github/workflows/deploy.yml`.

> One-time setup in the repo: **Settings → Pages → Build and deployment →
> Source = GitHub Actions.**

## Run it (full stack, local)

**1. Backend (Supabase local):**
```bash
supabase start          # needs Docker
supabase db reset       # runs migrations 0001–0005 + seed.sql
```
Copy the printed API URL + anon key.

**2. Frontend:**
```bash
cp .env.example .env.local   # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
```

**Login:** `admin@company.com` / `password123` (seed users; same password for all).

Against a hosted Supabase project instead: run the migrations + seed in the SQL
editor (numeric order), then point `.env.local` at the project URL/anon key.

## Roadmap

- **Phase 1 (MVP):** OKR tree, Critical 6 (daily), CFR (weekly), KPI manual/CSV,
  AI v1 (OKR quality, risk detection, weekly summary, today's #1).
- **Phase 2:** KPI live DB/API sync, automated notifications, escalation.
- **Phase 3:** CRM pipeline, KPI-vs-revenue gap analysis, forecasting.
