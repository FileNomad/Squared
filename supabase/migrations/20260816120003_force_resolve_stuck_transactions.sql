-- -----------------------------------------------------
-- FORCE-RESOLVE STUCK TRANSACTIONS
--
-- A transaction can end up with no one left who can ever
-- act on it: e.g. a 'confirmed' transaction can only be
-- advanced by its debtor calling mark_transaction_paid(),
-- but if that debtor's account has been deleted, nobody
-- can ever authenticate as them again.
--
-- prepare_account_deletion() already auto-rejects any
-- 'pending' transaction the deleted user would have had to
-- confirm, since that's a lossless default. It deliberately
-- leaves 'confirmed' and 'payment_pending' transactions
-- alone rather than guessing whether money changed hands.
-- This function lets the event creator - who has visibility
-- into the group - make that call explicitly, and only when
-- the party actually blocking progress is gone.
-- -----------------------------------------------------

create or replace function public.force_resolve_stuck_transaction(
  p_event_id uuid,
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tx record;
  blocking_user_id uuid;
  blocking_is_deleted boolean;
  new_status text;
begin
  if not public.is_event_creator(p_event_id) then
    raise exception 'Only the event creator can resolve this transaction';
  end if;

  select *
  into tx
  from public.transactions
  where id = p_transaction_id
    and event_id = p_event_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if tx.status = 'pending' then
    blocking_user_id := tx.creditor_id;
    new_status := 'rejected';
  elsif tx.status = 'confirmed' then
    blocking_user_id := tx.debtor_id;
    new_status := 'settled';
  elsif tx.status = 'payment_pending' then
    blocking_user_id := tx.creditor_id;
    new_status := 'settled';
  else
    raise exception 'Transaction is already resolved';
  end if;

  select is_deleted
  into blocking_is_deleted
  from public.profiles
  where id = blocking_user_id;

  if blocking_is_deleted is not true then
    raise exception 'This transaction is waiting on an active member and cannot be force-resolved';
  end if;

  update public.transactions
  set status = new_status
  where id = p_transaction_id;
end;
$$;

grant execute
on function public.force_resolve_stuck_transaction(uuid, uuid)
to authenticated;
