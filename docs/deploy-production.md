# Production Setup — let your team actually use it

The live site currently runs in **demo mode** (in-browser data that resets).
To make it a **real, shared, persistent** app your team logs into, connect a
free Supabase backend. You do steps 1–4 once (~10 min); after that, teammates
just open the URL and sign up — no development needed.

Live URL: **https://bstars00-rgb.github.io/Critical6/**

---

## 1. Create a Supabase project (free)
1. Go to https://supabase.com → sign in → **New project**.
2. Pick a name, a strong DB password, a region near your team. Wait ~2 min.

## 2. Apply the database schema
1. In the project: **SQL Editor → New query**.
2. Open `supabase/setup.sql` from this repo, paste the whole file, **Run**.
   - This creates all tables, security rules, and the signup→profile trigger.
   - Do **not** run `supabase/seed.sql` (that's fake demo data).

## 3. Configure Auth (so teammates can sign in)
In **Authentication → Sign In / Providers → Email**:
- Keep **Email** enabled.
- For an internal tool, optionally turn **"Confirm email" OFF** (Authentication
  → Providers → Email) so people can sign in immediately after signing up.
  Leave it ON if you want email verification (then teammates must click the
  link in their inbox first).
- In **Authentication → URL Configuration**, set **Site URL** to
  `https://bstars00-rgb.github.io/Critical6/` (so confirmation links return to
  the app).

## 4. Point the deployed app at your project
1. In Supabase: **Project Settings → API**. Copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (safe to embed in a frontend — it is **not** the
     `service_role` secret).
2. In GitHub: repo **Settings → Secrets and variables → Actions → New
   repository secret**, add two:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon public key
3. Re-deploy: repo **Actions → "Deploy prototype to GitHub Pages" → Run
   workflow** (or push any commit). The build now bakes in those values and the
   app uses the real backend instead of demo mode.

## 5. First login & inviting the team
- Open the URL → **Sign up**. **The first account automatically becomes admin.**
- Everyone else signs up too (they start as `member`).
- As admin you can adjust roles/teams. Quick way for now: Supabase **Table
  Editor → `users`** → set someone's `role` to `team_leader`/`executive`, and
  add rows in **`team_members`** to put people on teams. (A built-in admin UI
  for this can be added later.)

---

## Notes
- The **anon key is public by design** — RLS (row-level security) in the schema
  is what protects data. Never put the `service_role` key in the frontend or
  GitHub secrets used by the web build.
- Switching back to demo mode = just remove the two GitHub secrets and
  re-deploy.
- KPIs/CRM/etc. start empty in production (no demo data). Create your real OKRs,
  or ask me to add a small starter dataset.
- Free tier pauses a project after ~1 week of inactivity; opening the dashboard
  resumes it. Fine for a small internal team.
