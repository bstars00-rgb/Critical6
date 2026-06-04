-- =============================================================================
-- AI Execution OS — seed.sql  (dev only)
-- Runs after migrations on `supabase db reset`. Creates auth users + a realistic
-- Southeast Asia B2B dataset so every screen has live data on first launch.
-- Login: admin@company.com / password123  (same password for all seed users)
-- =============================================================================

-- ---- Auth users (local dev). Password = 'password123' (bcrypt via pgcrypto). ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','admin@company.com',   crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','exec@company.com',    crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','leader@company.com',  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','jihoon@company.com',  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','',''),
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','minseo@company.com',  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}','','','','');

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
from auth.users where email like '%@company.com';

-- ---- App profiles ----
insert into users (id, email, full_name, role, title) values
 ('11111111-1111-1111-1111-111111111111','admin@company.com','시스템 관리자','admin','Platform Admin'),
 ('22222222-2222-2222-2222-222222222222','exec@company.com','김대표','executive','CEO'),
 ('33333333-3333-3333-3333-333333333333','leader@company.com','이채널','team_leader','GST Channel Lead'),
 ('44444444-4444-4444-4444-444444444444','jihoon@company.com','박지훈','member','Channel Manager'),
 ('55555555-5555-5555-5555-555555555555','minseo@company.com','최민서','member','API Engineer');

-- ---- Teams ----
insert into teams (id, name, slug, lead_user_id) values
 ('a0000001-0000-0000-0000-000000000001','GST Channel','gst','33333333-3333-3333-3333-333333333333'),
 ('a0000002-0000-0000-0000-000000000002','OTA/API','ota','55555555-5555-5555-5555-555555555555'),
 ('a0000003-0000-0000-0000-000000000003','Sales CRM','sales','33333333-3333-3333-3333-333333333333'),
 ('a0000004-0000-0000-0000-000000000004','Japan/Korea','jpkr','44444444-4444-4444-4444-444444444444');

insert into team_members (team_id, user_id, team_role) values
 ('a0000001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','leader'),
 ('a0000001-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','member'),
 ('a0000002-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','leader'),
 ('a0000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','leader'),
 ('a0000004-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444','leader');

-- ---- Company Objectives ----
insert into objectives (id, title, level, owner_id, status, priority, quarter, year) values
 ('c0000001-0000-0000-0000-000000000001','2026 Southeast Asia B2B Channel Growth','company','22222222-2222-2222-2222-222222222222','in_progress','critical',2,2026),
 ('c0000002-0000-0000-0000-000000000002','2026 Revenue Growth','company','22222222-2222-2222-2222-222222222222','in_progress','critical',2,2026),
 ('c0000003-0000-0000-0000-000000000003','2026 AI-based Work Efficiency Improvement','company','22222222-2222-2222-2222-222222222222','in_progress','important',2,2026);

-- ---- Team Objectives ----
insert into objectives (id, title, level, owner_id, team_id, parent_objective_id, status, priority, quarter, year) values
 ('70000001-0000-0000-0000-000000000001','GST Channel Expansion','team','33333333-3333-3333-3333-333333333333','a0000001-0000-0000-0000-000000000001','c0000001-0000-0000-0000-000000000001','in_progress','urgent',2,2026),
 ('70000002-0000-0000-0000-000000000002','OTA/API Stability Improvement','team','55555555-5555-5555-5555-555555555555','a0000002-0000-0000-0000-000000000002','c0000001-0000-0000-0000-000000000001','at_risk','important',2,2026),
 ('70000003-0000-0000-0000-000000000003','Sales CRM & Pipeline Management','team','33333333-3333-3333-3333-333333333333','a0000003-0000-0000-0000-000000000003','c0000002-0000-0000-0000-000000000002','in_progress','important',2,2026),
 ('70000004-0000-0000-0000-000000000004','Japan/Korea Client Expansion','team','44444444-4444-4444-4444-444444444444','a0000004-0000-0000-0000-000000000004','c0000002-0000-0000-0000-000000000002','in_progress','medium',2,2026);

-- ---- Key Results (progress auto-calculated by trigger) ----
insert into key_results (id, objective_id, title, metric_type, target_value, current_value, unit, owner_id, status, priority, due_date) values
 ('40000001-0000-0000-0000-000000000001','70000001-0000-0000-0000-000000000001','KR1 Active Channel 1000','active_channel_count',1000,640,'channels','33333333-3333-3333-3333-333333333333','in_progress','urgent','2026-09-30'),
 ('40000002-0000-0000-0000-000000000002','70000003-0000-0000-0000-000000000003','KR2 Revenue Growth 7000','revenue',7000,4200,'kUSD','33333333-3333-3333-3333-333333333333','in_progress','critical','2026-12-31'),
 ('40000003-0000-0000-0000-000000000003','70000002-0000-0000-0000-000000000002','KR3 API Stability 99.5%','api_success_rate',99.5,98.7,'%','55555555-5555-5555-5555-555555555555','at_risk','important','2026-06-15'),
 ('40000004-0000-0000-0000-000000000004','70000004-0000-0000-0000-000000000004','KR4 Customer Expansion 65%','new_client_count',65,40,'%','44444444-4444-4444-4444-444444444444','in_progress','medium','2026-12-31'),
 ('40000005-0000-0000-0000-000000000005','c0000003-0000-0000-0000-000000000003','KR5 AI Work Efficiency Improvement','automation_rate',100,30,'%','11111111-1111-1111-1111-111111111111','in_progress','important','2026-12-31');

-- ---- KPIs ----
insert into kpis (name, key_result_id, objective_id, team_id, owner_id, metric_type, unit, target_value, current_value, previous_value, update_method, external_id) values
 ('Active Channel Count','40000001-0000-0000-0000-000000000001','70000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','active_channel_count','channels',1000,640,600,'database','active_channels'),
 ('Monthly Booking Count',null,'70000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','booking_count','bookings',50000,38000,35000,'database','monthly_bookings'),
 ('Monthly Revenue','40000002-0000-0000-0000-000000000002','70000003-0000-0000-0000-000000000003','a0000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','revenue','kUSD',7000,4200,3800,'database','mrr_sea'),
 ('API Success Rate','40000003-0000-0000-0000-000000000003','70000002-0000-0000-0000-000000000002','a0000002-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','api_success_rate','%',99.5,98.7,99.1,'api','success_rate_24h'),
 ('Mapping Completion Rate',null,'70000002-0000-0000-0000-000000000002','a0000002-0000-0000-0000-000000000002','55555555-5555-5555-5555-555555555555','mapping_completion_rate','%',100,82,78,'database','mapping_rate'),
 ('CRM Pipeline Value',null,'70000003-0000-0000-0000-000000000003','a0000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','crm_pipeline_value','kUSD',10000,6200,5500,'crm','pipeline_value'),
 ('CFR Completion Rate',null,null,null,'11111111-1111-1111-1111-111111111111','automation_rate','%',100,70,65,'manual','cfr_rate'),
 ('Critical 6 Completion Rate',null,null,null,'11111111-1111-1111-1111-111111111111','automation_rate','%',100,55,50,'manual','c6_rate');

-- ---- Critical 6 (owner = GST leader; one set today/weekly focus) ----
insert into critical_six (id, title, key_result_id, objective_id, owner_id, team_id, status, priority, completion_criteria, due_date, is_today_focus, is_weekly_focus, focus_date) values
 ('c6000001-0000-0000-0000-000000000001','오늘 Ctrip Rate Plan 제한 이슈 정리','40000001-0000-0000-0000-000000000001','70000001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','a0000001-0000-0000-0000-000000000001','in_progress','critical','영향 호텔 리스트 확정 + 대응안 공유','2026-06-06',true,true,'2026-06-04'),
 ('c6000002-0000-0000-0000-000000000002','GGT SLA 최종 피드백 확인','40000002-0000-0000-0000-000000000002','70000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','a0000003-0000-0000-0000-000000000003','in_progress','urgent','SLA 문서 사인오프','2026-06-07',true,true,'2026-06-04'),
 ('c6000003-0000-0000-0000-000000000003','Agoda 계약수정합의서 재확인','40000001-0000-0000-0000-000000000001','70000001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','a0000001-0000-0000-0000-000000000001','delayed','important','법무 검토 완료','2026-06-02',false,true,null),
 ('c6000004-0000-0000-0000-000000000004','Sales CRM 구조 초안 작성','40000002-0000-0000-0000-000000000002','70000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','a0000003-0000-0000-0000-000000000003','in_progress','important','ERD + 화면 흐름 초안','2026-06-10',false,true,null),
 ('c6000005-0000-0000-0000-000000000005','AI Challenge 팀별 과제 정리','40000005-0000-0000-0000-000000000005','c0000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333',null,'not_started','medium','팀별 과제 1개씩 확정','2026-06-12',false,true,null),
 ('c6000006-0000-0000-0000-000000000006','Traveloka 정산 법인 확인','40000001-0000-0000-0000-000000000001','70000001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','a0000001-0000-0000-0000-000000000001','at_risk','urgent','정산 법인/통화 확정','2026-06-08',false,true,null);

-- ---- Action Plans (linked to KR / Critical 6) ----
insert into action_plans (title, key_result_id, critical_six_id, owner_id, team_id, status, priority, due_date) values
 ('Ctrip affected hotel list 확인','40000001-0000-0000-0000-000000000001','c6000001-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','a0000001-0000-0000-0000-000000000001','in_progress','critical','2026-06-05'),
 ('Agoda Contract Amendment 확인','40000001-0000-0000-0000-000000000001','c6000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','a0000001-0000-0000-0000-000000000001','delayed','important','2026-06-02'),
 ('Traveloka Settlement Entity 확인','40000001-0000-0000-0000-000000000001','c6000006-0000-0000-0000-000000000006','44444444-4444-4444-4444-444444444444','a0000001-0000-0000-0000-000000000001','at_risk','urgent','2026-06-08'),
 ('GGT SLA 마무리','40000002-0000-0000-0000-000000000002','c6000002-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333','a0000003-0000-0000-0000-000000000003','in_progress','urgent','2026-06-07'),
 ('Sales CRM 구축',null,'c6000004-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333333','a0000003-0000-0000-0000-000000000003','in_progress','important','2026-07-01'),
 ('AI Challenge 진행','40000005-0000-0000-0000-000000000005','c6000005-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',null,'not_started','medium','2026-06-20'),
 ('Japan/Korea Client Expansion','40000004-0000-0000-0000-000000000004',null,'44444444-4444-4444-4444-444444444444','a0000004-0000-0000-0000-000000000004','in_progress','medium','2026-08-01'),
 ('ITB India 준비',null,null,'44444444-4444-4444-4444-444444444444','a0000004-0000-0000-0000-000000000004','not_started','low','2026-07-15'),
 ('Mapping Completion Rate 개선','40000003-0000-0000-0000-000000000003',null,'55555555-5555-5555-5555-555555555555','a0000002-0000-0000-0000-000000000002','in_progress','important','2026-06-30'),
 ('API Error Rate 점검','40000003-0000-0000-0000-000000000003',null,'55555555-5555-5555-5555-555555555555','a0000002-0000-0000-0000-000000000002','at_risk','urgent','2026-06-11');

-- ---- CRM Accounts ----
insert into crm_accounts (company_name, country, market, account_owner_id, account_status, account_grade, expected_revenue, related_key_result_id) values
 ('Ctrip','China','SEA/CN','33333333-3333-3333-3333-333333333333','active','strategic',2500,'40000001-0000-0000-0000-000000000001'),
 ('Agoda','Singapore','SEA','33333333-3333-3333-3333-333333333333','active','strategic',2000,'40000001-0000-0000-0000-000000000001'),
 ('Traveloka','Indonesia','SEA','44444444-4444-4444-4444-444444444444','active','a',1500,'40000001-0000-0000-0000-000000000001'),
 ('Dida','China','CN','44444444-4444-4444-4444-444444444444','prospect','b',800,'40000001-0000-0000-0000-000000000001'),
 ('Go Global Travel','UK','EU','33333333-3333-3333-3333-333333333333','active','a',1200,'40000002-0000-0000-0000-000000000002'),
 ('Hotelpass','Korea','KR','44444444-4444-4444-4444-444444444444','active','b',600,'40000004-0000-0000-0000-000000000004'),
 ('MyRealTrip','Korea','KR','44444444-4444-4444-4444-444444444444','prospect','b',500,'40000004-0000-0000-0000-000000000004'),
 ('HanaTour','Korea','KR','44444444-4444-4444-4444-444444444444','prospect','c',400,'40000004-0000-0000-0000-000000000004');

-- ---- One CFR check-in (current-ish week) so history isn't empty ----
insert into cfr_checkins (related_type, related_id, user_id, team_id, week_start_date,
  progress_summary, completed_work, blockers, next_week_actions, risk_level, confidence_score) values
 ('key_result','40000001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','a0000001-0000-0000-0000-000000000001','2026-06-01',
  'Active Channel 640까지 확대. Ctrip/Traveloka 이슈가 병목.',
  'Agoda 신규 연동 2건','Ctrip Rate Plan 제한, Traveloka 정산 법인 미확정','대응안 확정 + 법무 검토','high',6);

-- ---- A couple of AI insights for the Dashboard ----
insert into ai_insights (insight_type, related_type, related_id, team_id, title, summary, risk_level, model) values
 ('risk_detection','key_result','40000003-0000-0000-0000-000000000003','a0000002-0000-0000-0000-000000000002','API Stability 위험','KR3 진행률 낮고 마감(6/15) 임박. API Error Rate 점검 작업도 at_risk.','high','rule-engine'),
 ('next_action','critical_six','c6000003-0000-0000-0000-000000000003','a0000001-0000-0000-0000-000000000001','지연 작업 우선 처리','Agoda 계약수정 작업이 지연 상태입니다. 신규 작업보다 먼저 마감하세요.','medium','rule-engine');

-- ---- CRM follow-ups + opportunities (pipeline) ----
update crm_accounts set next_followup_date = date '2026-06-05', last_contact_date = date '2026-05-28'
  where company_name in ('Ctrip', 'Traveloka');
update crm_accounts set next_followup_date = date '2026-06-02', last_contact_date = date '2026-05-20'
  where company_name in ('Dida', 'MyRealTrip');   -- overdue follow-ups
update crm_accounts set actual_revenue = expected_revenue * 0.4 where account_status = 'active';

insert into crm_opportunities (opportunity_name, account_id, owner_id, stage, expected_revenue,
  probability, expected_close_date, related_key_result_id, next_action, risk_level)
select v.name, a.id, a.account_owner_id, v.stage, v.exp, v.prob, v.close::date,
       '40000001-0000-0000-0000-000000000001', v.next_action, v.risk::risk_level
from (values
  ('Vietnam Hotel Campaign','Traveloka','negotiation',1500,60,'2026-07-15','rate plan 최종 확정','medium'),
  ('Ctrip Rate Plan Renewal','Ctrip','contract',2500,80,'2026-06-30','계약서 사인','high'),
  ('Agoda SEA Expansion','Agoda','proposal',2000,50,'2026-08-01','제안서 발송','medium'),
  ('Dida China Onboarding','Dida','meeting',800,30,'2026-09-01','킥오프 미팅 일정','low'),
  ('GGT EU Volume Deal','Go Global Travel','integration',1200,70,'2026-07-20','API 연동 마무리','medium'),
  ('HanaTour KR Pilot','HanaTour','lead',400,20,'2026-10-01','초기 컨택','low')
) as v(name, company, stage, exp, prob, close, next_action, risk)
join crm_accounts a on a.company_name = v.company;

-- ---- KPI history: 4 weekly points per KPI trending previous_value → current_value
-- so the KPI Trend chart has data on first launch. ----
insert into kpi_history (kpi_id, value, recorded_at, source)
select k.id,
       round((k.previous_value + (k.current_value - k.previous_value) * g / 4.0)::numeric, 2),
       (timestamptz '2026-06-01 09:00+00' - make_interval(days => (4 - g) * 7)),
       'manual'
from kpis k
cross join generate_series(1, 4) as g
where k.current_value is not null and k.previous_value is not null;
