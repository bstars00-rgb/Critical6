-- =============================================================================
-- AI Execution OS — 0006_auth_profile.sql
-- Auto-provision a public.users profile whenever someone signs up via Supabase
-- Auth, so a team can self-onboard with NO manual SQL per person.
-- The very first account becomes 'admin'; everyone after is 'member'
-- (an admin can promote others later).
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_existing int;
begin
  select count(*) into v_existing from public.users;
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when v_existing = 0 then 'admin' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
