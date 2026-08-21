-- -----------------------------------------------------
-- Make prepare_account_deletion's lockdown explicit rather
-- than implicit.
--
-- The live project already blocks `authenticated` from
-- calling this (confirmed via has_function_privilege), but
-- that's Supabase's hosted platform revoking PUBLIC
-- execute on new functions by default, not anything this
-- migration set explicitly - a `supabase start` local
-- instance does NOT replicate that default and leaves the
-- function open until revoked. See the updated comment in
-- 20260816120002_account_deletion.sql for the full story.
-- Redundant on the live project right now; not redundant
-- anywhere this schema gets applied fresh.
-- -----------------------------------------------------

revoke execute
on function public.prepare_account_deletion(uuid)
from public;
