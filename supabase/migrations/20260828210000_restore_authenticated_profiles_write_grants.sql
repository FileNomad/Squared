-- -----------------------------------------------------
-- The live database was missing INSERT/UPDATE grants for
-- `authenticated` on public.profiles, despite
-- 20260816120000_profiles.sql declaring
-- `grant select, insert, update on public.profiles to authenticated`.
-- Live only had SELECT - confirmed via
-- information_schema.role_table_grants on the linked project.
--
-- Net effect: every new sign-up broke at the "choose your
-- display name" step with "permission denied for table
-- profiles", since RLS policies are evaluated only after the
-- coarser table-level GRANT check passes. Existing accounts
-- created before this drifted were unaffected since they
-- already had a profile row.
-- -----------------------------------------------------

grant insert, update on public.profiles to authenticated;
