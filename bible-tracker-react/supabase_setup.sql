-- Bible Reading Journey 2026
-- Run this whole script in: Supabase Dashboard -> SQL Editor -> New query -> Run

-- ─────────────────────────────────────────────
-- IMPORTANT: Disable email confirmation first!
-- Supabase Dashboard → Authentication → Providers → Email
-- Turn OFF "Confirm email"
-- ─────────────────────────────────────────────

-- Profiles table — stores the display username for each user.
create table if not exists public.profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_key text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, reading_key)
);

create table if not exists public.reading_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  reading_key text not null,
  activity_date date not null default current_date,
  completed_at timestamptz not null default now(),
  primary key (user_id, reading_key, activity_date)
);

create index if not exists reading_activity_user_date_idx
  on public.reading_activity (user_id, activity_date desc);

alter table public.reading_progress enable row level security;
alter table public.reading_activity enable row level security;

-- Restrict the browser client to authenticated users only.
grant usage on schema public to authenticated;
revoke all on table public.reading_progress from anon, authenticated;
revoke all on table public.reading_activity from anon, authenticated;

grant select, insert, update, delete on table public.reading_progress to authenticated;
grant select, insert, update, delete on table public.reading_activity to authenticated;

-- reading_progress: a user can access only their own rows.
drop policy if exists "Users can view own reading progress" on public.reading_progress;
create policy "Users can view own reading progress"
on public.reading_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own reading progress" on public.reading_progress;
create policy "Users can insert own reading progress"
on public.reading_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own reading progress" on public.reading_progress;
create policy "Users can update own reading progress"
on public.reading_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own reading progress" on public.reading_progress;
create policy "Users can delete own reading progress"
on public.reading_progress
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- reading_activity: daily history is append/updateable only by the same user.
drop policy if exists "Users can view own reading activity" on public.reading_activity;
create policy "Users can view own reading activity"
on public.reading_activity
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own reading activity" on public.reading_activity;
create policy "Users can insert own reading activity"
on public.reading_activity
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own reading activity" on public.reading_activity;
create policy "Users can update own reading activity"
on public.reading_activity
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own reading activity" on public.reading_activity;
create policy "Users can delete own reading activity"
on public.reading_activity
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Optional: keep updated_at current when a progress row changes.
create or replace function public.set_reading_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reading_progress_updated_at on public.reading_progress;
create trigger reading_progress_updated_at
before update on public.reading_progress
for each row execute function public.set_reading_progress_updated_at();

-- Verify the tables and policies exist.
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('reading_progress', 'reading_activity')
order by table_name;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('reading_progress', 'reading_activity')
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('reading_progress', 'reading_activity')
order by tablename, policyname;
