-- -----------------------------------------------------
-- Close the same PUBLIC-execute gap across every security
-- definer function in the schema, not just
-- prepare_account_deletion.
--
-- Every `create or replace function` in this project got
-- Postgres's default EXECUTE-to-PUBLIC grant, since none of
-- them were followed by an explicit revoke - only the
-- functions I remembered to add `grant ... to authenticated`
-- for got locked down from `anon` as a side effect of that
-- being additive, not a replacement. Confirmed directly via
-- `supabase db advisors --linked --type security`: it
-- flagged every one of these as executable by `anon` on the
-- live project.
--
-- Revoking PUBLIC and then granting back only to
-- `authenticated` where actually needed:
--   - is_event_member, is_user_event_member,
--     shares_event_with_user: called directly from RLS
--     `using`/`with check` clauses, which evaluate as the
--     querying role - authenticated genuinely needs execute
--     on these or those policies stop working entirely.
--   - is_event_creator: only ever called from inside other
--     security definer functions (all owned by postgres),
--     never directly from a policy or a client RPC call.
--     Those internal calls run with the owning function's
--     privileges, so postgres (a superuser) already has
--     implicit access - no grant to authenticated needed.
--   - every actual RPC (create_event, add_event_member_by_name,
--     confirm_transaction, reject_transaction,
--     mark_transaction_paid, confirm_settlement,
--     reject_settlement, force_resolve_stuck_transaction,
--     cancel_transaction, edit_pending_transaction,
--     leave_event, remove_event_member): already has an
--     explicit grant to authenticated from its own
--     migration - this just removes anon's extra access.
--
-- Also sets a default so this can't quietly recur as the
-- schema grows: new functions created by the migration-
-- running role no longer default to PUBLIC execute.
-- -----------------------------------------------------

revoke execute
on function public.is_event_member(uuid)
from public;

grant execute
on function public.is_event_member(uuid)
to authenticated;

revoke execute
on function public.is_user_event_member(uuid, uuid)
from public;

grant execute
on function public.is_user_event_member(uuid, uuid)
to authenticated;

revoke execute
on function public.is_event_creator(uuid)
from public;

revoke execute
on function public.shares_event_with_user(uuid)
from public;

grant execute
on function public.shares_event_with_user(uuid)
to authenticated;

revoke execute
on function public.create_event(text, text)
from public;

revoke execute
on function public.add_event_member_by_name(uuid, text)
from public;

revoke execute
on function public.confirm_transaction(uuid, uuid)
from public;

revoke execute
on function public.reject_transaction(uuid, uuid)
from public;

revoke execute
on function public.mark_transaction_paid(uuid, uuid)
from public;

revoke execute
on function public.confirm_settlement(uuid, uuid)
from public;

revoke execute
on function public.reject_settlement(uuid, uuid)
from public;

revoke execute
on function public.force_resolve_stuck_transaction(uuid, uuid)
from public;

revoke execute
on function public.cancel_transaction(uuid, uuid)
from public;

revoke execute
on function public.edit_pending_transaction(uuid, uuid, uuid, integer, text)
from public;

revoke execute
on function public.leave_event(uuid)
from public;

revoke execute
on function public.remove_event_member(uuid, uuid)
from public;

alter default privileges for role postgres in schema public
revoke execute on functions from public;
