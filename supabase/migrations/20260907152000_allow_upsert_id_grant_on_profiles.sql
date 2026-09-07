-- -----------------------------------------------------
-- create-profile.tsx calls .upsert(), not .insert() - the
-- resulting PostgREST query is
-- `insert ... on conflict (id) do update set id =
-- excluded.id, display_name = excluded.display_name`, which
-- includes the conflict column itself in the SET clause.
-- Postgres requires UPDATE privilege on every column named
-- in a SET clause, including a no-op `id = excluded.id`, so
-- 20260828220001's `update (display_name)` grant wasn't
-- actually enough - every new sign-up has been failing at
-- the "choose your name" step since that migration, the same
-- failure mode as 20260828210000 for a different reason.
--
-- Confirmed via a full db reset that this wasn't caught by
-- the pgTAP suite: those tests insert directly with plain
-- SQL, never through the actual upsert PostgREST generates.
--
-- Granting UPDATE on id doesn't weaken anything - the
-- existing RLS `with check (auth.uid() = id)` already makes
-- it impossible to write a row for anyone but yourself,
-- verified directly: an authenticated user attempting to
-- upsert another user's row (by id) is still rejected by RLS
-- regardless of this grant.
-- -----------------------------------------------------

grant update (id)
on public.profiles
to authenticated;
