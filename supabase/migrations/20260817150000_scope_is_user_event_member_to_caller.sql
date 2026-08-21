-- -----------------------------------------------------
-- is_user_event_member(p_event_id, p_user_id) never
-- checked that the CALLER has any legitimate connection to
-- p_event_id before answering whether an arbitrary
-- p_user_id is a member of it.
--
-- authenticated needs EXECUTE on this function for the
-- transactions INSERT policy to work (it's called from a
-- `with check` clause, which evaluates as the querying
-- role) - which unavoidably also exposes it as a direct
-- callable RPC via PostgREST. That meant any signed-in user
-- could call it directly with an arbitrary event_id and
-- user_id to probe other people's group memberships,
-- bypassing the event_members table's own RLS entirely
-- ("Members can view event membership" only shows you
-- membership rows for events you're actually in).
--
-- Every real caller of this function already is a member of
-- p_event_id by the time it's invoked (the transactions
-- policy checks is_event_member(event_id) in the same
-- clause; edit_pending_transaction and remove_event_member
-- only call it after their own is_event_creator/ownership
-- checks). Requiring that here too closes the standalone-
-- probe path without changing behavior for any legitimate
-- caller.
-- -----------------------------------------------------

create or replace function public.is_user_event_member(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_event_member(p_event_id)
    and exists (
      select 1
      from public.event_members
      where event_id = p_event_id
        and user_id = p_user_id
    );
$$;
