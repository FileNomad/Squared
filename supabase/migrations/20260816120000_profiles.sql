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
-- PROFILE RLS
--
-- The select policy here is deliberately narrower than
-- the final version: "only your own profile" rather than
-- "your own or anyone you share an event with". The fuller
-- version depends on shares_event_with_user(), which reads
-- event_members - a table that doesn't exist yet at this
-- point in the migration sequence (it's created in
-- 20260816120001). Unlike a plpgsql function, a `language
-- sql` function's body is parsed and validated immediately
-- at CREATE FUNCTION time, so it can't reference a
-- not-yet-existing table the way a plpgsql function could.
-- 20260816120001 drops and replaces this policy with the
-- real one once event_members exists.
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
