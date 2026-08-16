-- -----------------------------------------------------
-- CLOSE TWO PRIVILEGE GAPS
-- -----------------------------------------------------

-- 1. The transactions INSERT policy never constrained
--    `status`, so any member could insert a transaction
--    already 'settled' or 'confirmed' directly via the API,
--    bypassing the confirm/reject workflow entirely. Only
--    the app's own UI ever sent 'pending' - RLS is the real
--    boundary, and it didn't enforce this.
drop policy if exists
"Debtors can create their own transactions"
on public.transactions;

create policy "Debtors can create their own transactions"
on public.transactions
for insert
to authenticated
with check (
  debtor_id = (select auth.uid())
  and public.is_event_member(event_id)
  and public.is_user_event_member(
    event_id,
    creditor_id
  )
  and status = 'pending'
);


-- 2. profiles had a blanket `grant update ... to
--    authenticated`, so a user could set is_deleted on
--    their own row directly - which force_resolve_stuck_
--    transaction() trusts as proof an account is really
--    gone. That let a user who is both an event's creator
--    and a debtor on a confirmed transaction fake their own
--    deletion just long enough to force-settle a real debt.
--    Restrict the grant to the one column that's actually
--    meant to be self-service.
revoke insert, update
on public.profiles
from authenticated;

grant insert (id, display_name)
on public.profiles
to authenticated;

grant update (display_name)
on public.profiles
to authenticated;
