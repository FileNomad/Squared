-- -----------------------------------------------------
-- REMOVE BOTH TRANSACTION CONFIRMATION GATES
--
-- Field-tested on a real trip: requiring the creditor to
-- separately confirm (a) that a debt is real and (b) that
-- payment was actually received added friction without
-- matching how the app is actually used - a small group of
-- friends who trust each other's claims. Both gates are
-- removed:
--
--   - Creating a transaction now goes straight to
--     'confirmed' instead of 'pending'. Creating one takes
--     real effort (open the app, pick a person, enter an
--     amount) - not something that happens by mistake the
--     way a stray tap could, so a separate creditor sign-off
--     buys little.
--   - mark_transaction_paid() now sets 'settled' directly
--     instead of 'payment_pending', trusting the debtor's
--     own claim that they paid. edit_transaction (renamed
--     from edit_pending_transaction) and cancel_transaction
--     remain as the debtor's own correction path for a
--     mistake, right up until they mark it paid.
--
-- Net effect: 'pending', 'payment_pending', and 'rejected'
-- all become unreachable - nothing ever creates them again -
-- so they're dropped from the status check constraint too,
-- and confirm_transaction / reject_transaction /
-- confirm_settlement / reject_settlement are dropped
-- outright rather than left as dead code.
--
-- Every function this migration touches with `create or
-- replace` gets an explicit
-- `revoke execute ... from public, anon, authenticated`
-- right after it, confirmed necessary by actually running the
-- pgTAP suite against this migration and inspecting
-- pg_default_acl: a default-privileges rule (seeded per-role,
-- not something any project migration set) grants execute on
-- every new/replaced function directly to anon and
-- authenticated, not to the PUBLIC pseudo-role - so the
-- "revoke ... from public" pattern 20260816120002 /
-- 20260817130000 / 20260817140000 used never actually
-- touched anon or authenticated's access at all, on any
-- function, including ones this migration never replaces.
-- That's a pre-existing gap, not something introduced here -
-- scoped down here to only the functions this migration
-- already has to replace anyway, since re-auditing every
-- function in the schema is a separate piece of work.
-- -----------------------------------------------------

--
-- Backfill existing rows (this project already has real
-- production data) before the constraint stops allowing
-- their current values. 'rejected' and 'pending' both meant
-- "this claimed debt doesn't stand" - the closest surviving
-- status is 'cancelled'.
--
update public.transactions
set status = 'confirmed'
where status = 'pending';

update public.transactions
set status = 'settled'
where status = 'payment_pending';

update public.transactions
set status = 'cancelled'
where status = 'rejected';

alter table public.transactions
drop constraint if exists transactions_status_check;

alter table public.transactions
add constraint transactions_status_check
check (
  status in (
    'confirmed',
    'settled',
    'cancelled'
  )
);


--
-- New transactions are created directly as 'confirmed'.
--
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
  and status = 'confirmed'
);


--
-- Marking paid settles directly - no creditor receipt
-- confirmation step.
--
create or replace function public.mark_transaction_paid(
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
  set status = 'settled'
  where id = p_transaction_id
    and event_id = p_event_id
    and debtor_id = auth.uid()
    and status = 'confirmed';

  if not found then
    raise exception 'Transaction cannot be marked as paid';
  end if;
end;
$$;

revoke execute
on function public.mark_transaction_paid(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.mark_transaction_paid(uuid, uuid)
to authenticated;


--
-- Dead now that nothing ever creates 'pending' or
-- 'payment_pending' rows.
--
drop function if exists public.confirm_transaction(uuid, uuid);
drop function if exists public.reject_transaction(uuid, uuid);
drop function if exists public.confirm_settlement(uuid, uuid);
drop function if exists public.reject_settlement(uuid, uuid);


--
-- cancel_transaction and edit_transaction (renamed from
-- edit_pending_transaction, since 'pending' no longer
-- exists) now guard on 'confirmed' - the only state a
-- transaction sits in before the debtor marks it paid.
--
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
    and status = 'confirmed';

  if not found then
    raise exception 'Transaction cannot be cancelled';
  end if;
end;
$$;

revoke execute
on function public.cancel_transaction(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.cancel_transaction(uuid, uuid)
to authenticated;

drop function if exists public.edit_pending_transaction(uuid, uuid, uuid, integer, text);

create or replace function public.edit_transaction(
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
    and status = 'confirmed';

  if not found then
    raise exception 'Transaction cannot be edited';
  end if;
end;
$$;

revoke execute
on function public.edit_transaction(uuid, uuid, uuid, integer, text)
from public, anon, authenticated;

grant execute
on function public.edit_transaction(uuid, uuid, uuid, integer, text)
to authenticated;


--
-- force_resolve_stuck_transaction: the 'pending' and
-- 'payment_pending' branches are gone along with those
-- statuses. The one remaining way a transaction can be
-- permanently stuck is a deleted debtor who can never call
-- mark_transaction_paid() themselves - a deleted creditor no
-- longer blocks anything, since confirming the debt and
-- confirming receipt aren't things a creditor does anymore.
--
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
  debtor_is_deleted boolean;
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

  if tx.status <> 'confirmed' then
    raise exception 'Transaction is already resolved';
  end if;

  select is_deleted
  into debtor_is_deleted
  from public.profiles
  where id = tx.debtor_id;

  if debtor_is_deleted is not true then
    raise exception 'This transaction is waiting on an active member and cannot be force-resolved';
  end if;

  update public.transactions
  set status = 'settled'
  where id = p_transaction_id;
end;
$$;

revoke execute
on function public.force_resolve_stuck_transaction(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.force_resolve_stuck_transaction(uuid, uuid)
to authenticated;


--
-- prepare_account_deletion: the auto-reject-pending-debts
-- step is gone along with 'pending' itself. A deleted user
-- no longer blocks anything as a creditor (there's nothing
-- left for a creditor to confirm); as a debtor on a
-- 'confirmed' transaction they're already handled by
-- force_resolve_stuck_transaction above.
--
create or replace function public.prepare_account_deletion(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record record;
  replacement_owner uuid;
  deleted_name text;
begin
  --
  -- Delete events where this user is the only member.
  --
  delete from public.events e
  where e.created_by = p_user_id
    and not exists (
      select 1
      from public.event_members em
      where em.event_id = e.id
        and em.user_id <> p_user_id
    );


  --
  -- Transfer ownership of shared events created by
  -- this user to the longest-standing remaining member.
  --
  for event_record in
    select id
    from public.events
    where created_by = p_user_id
  loop
    select em.user_id
    into replacement_owner
    from public.event_members em
    where em.event_id = event_record.id
      and em.user_id <> p_user_id
    order by em.joined_at asc
    limit 1;

    if replacement_owner is not null then
      update public.events
      set created_by = replacement_owner
      where id = event_record.id;
    end if;
  end loop;


  --
  -- Remove the user's active event memberships.
  --
  delete from public.event_members
  where user_id = p_user_id;


  --
  -- Keep the profile row because historical transactions
  -- reference it, but remove the user's identity.
  --
  deleted_name :=
    'Deleted User ' ||
    substring(
      gen_random_uuid()::text,
      1,
      8
    );

  update public.profiles
  set
    display_name = deleted_name,
    is_deleted = true
  where id = p_user_id;
end;
$$;

--
-- create or replace resets a function's grants back to
-- Postgres's PUBLIC-execute default, undoing the explicit
-- revokes from 20260816120002 and 20260817130000 - the same
-- lesson those migrations exist to teach. Re-revoke rather
-- than assume the prior revoke survives a replace.
--
revoke execute
on function public.prepare_account_deletion(uuid)
from public, anon, authenticated;


--
-- leave_event / remove_event_member: the only remaining
-- "open transaction" status is 'confirmed'.
--
create or replace function public.leave_event(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_event_creator(p_event_id) then
    raise exception 'The event creator cannot leave. Delete the event instead.';
  end if;

  if not public.is_event_member(p_event_id) then
    raise exception 'You are not a member of this event';
  end if;

  if exists (
    select 1
    from public.transactions
    where event_id = p_event_id
      and (
        debtor_id = auth.uid()
        or creditor_id = auth.uid()
      )
      and status = 'confirmed'
  ) then
    raise exception 'Resolve your open transactions in this event before leaving';
  end if;

  delete from public.event_members
  where event_id = p_event_id
    and user_id = auth.uid();
end;
$$;

revoke execute
on function public.leave_event(uuid)
from public, anon, authenticated;

grant execute
on function public.leave_event(uuid)
to authenticated;

create or replace function public.remove_event_member(
  p_event_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_event_creator(p_event_id) then
    raise exception 'Only the event creator can remove members';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'The event creator cannot remove themselves. Delete the event instead.';
  end if;

  if not public.is_user_event_member(
    p_event_id,
    p_user_id
  ) then
    raise exception 'That person is not a member of this event';
  end if;

  if exists (
    select 1
    from public.transactions
    where event_id = p_event_id
      and (
        debtor_id = p_user_id
        or creditor_id = p_user_id
      )
      and status = 'confirmed'
  ) then
    raise exception 'This member has open transactions in this event and cannot be removed yet';
  end if;

  delete from public.event_members
  where event_id = p_event_id
    and user_id = p_user_id;
end;
$$;

revoke execute
on function public.remove_event_member(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.remove_event_member(uuid, uuid)
to authenticated;
