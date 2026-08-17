-- -----------------------------------------------------
-- CANCEL / EDIT A PENDING TRANSACTION
--
-- Lets the debtor who created a transaction fix a mistake
-- (wrong amount, wrong person, typo) or back out of it
-- entirely, as long as the creditor hasn't acted on it yet.
-- Once it leaves 'pending' (confirmed, rejected, etc.) it's
-- no longer editable or cancellable - that mirrors every
-- other transition RPC's "only from the right state" rule.
-- -----------------------------------------------------

alter table public.transactions
drop constraint if exists transactions_status_check;

alter table public.transactions
add constraint transactions_status_check
check (
  status in (
    'pending',
    'confirmed',
    'rejected',
    'payment_pending',
    'settled',
    'cancelled'
  )
);

create or replace function public.cancel_transaction(
  p_event_id uuid,
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.transactions
  set status = 'cancelled'
  where id = p_transaction_id
    and event_id = p_event_id
    and debtor_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Transaction cannot be cancelled';
  end if;
end;
$$;

create or replace function public.edit_pending_transaction(
  p_event_id uuid,
  p_transaction_id uuid,
  p_creditor_id uuid,
  p_amount_in_pence integer,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount_in_pence <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_creditor_id = auth.uid() then
    raise exception 'You cannot owe yourself';
  end if;

  if not public.is_user_event_member(
    p_event_id,
    p_creditor_id
  ) then
    raise exception 'The selected member is not part of this event';
  end if;

  update public.transactions
  set
    creditor_id = p_creditor_id,
    amount_in_pence = p_amount_in_pence,
    description = trim(p_description)
  where id = p_transaction_id
    and event_id = p_event_id
    and debtor_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Transaction cannot be edited';
  end if;
end;
$$;

grant execute
on function public.cancel_transaction(uuid, uuid)
to authenticated;

grant execute
on function public.edit_pending_transaction(uuid, uuid, uuid, integer, text)
to authenticated;
