-- -----------------------------------------------------
-- PROFILES
-- -----------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Set by prepare_account_deletion() when an account is removed.
-- The row is kept (historical transactions reference it) but the
-- user's identity is scrubbed. See 0003_account_deletion.sql.
alter table public.profiles
add column if not exists is_deleted boolean not null default false;

-- Display names are used to find people when adding them
-- to an event, so make them unique ignoring case.
create unique index if not exists profiles_display_name_lower_unique
on public.profiles (lower(display_name));

alter table public.profiles
enable row level security;

grant select, insert, update on public.profiles to authenticated;

-- -----------------------------------------------------
-- HELPER FUNCTIONS
--
-- Defined here because the profiles RLS policy below
-- depends on shares_event_with_user(), which in turn
-- reads event_members. Declared before that table exists
-- is fine in Postgres as long as it exists by the time the
-- function is first *called*.
-- -----------------------------------------------------

create or replace function public.shares_event_with_user(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members mine
    join public.event_members theirs
      on theirs.event_id = mine.event_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- -----------------------------------------------------
-- PROFILE RLS
--
-- Only your own profile and profiles of people you share
-- an event with are visible - not every registered user.
-- -----------------------------------------------------

drop policy if exists
"Authenticated users can view profiles"
on public.profiles;

drop policy if exists
"Users can view relevant profiles"
on public.profiles;

create policy "Users can view relevant profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.shares_event_with_user(id)
);

drop policy if exists
"Users can create their own profile"
on public.profiles;

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists
"Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
