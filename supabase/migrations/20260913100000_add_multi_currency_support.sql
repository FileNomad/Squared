-- -----------------------------------------------------
-- MULTI-CURRENCY SUPPORT
--
-- Each event has a primary_currency that every balance in
-- that event is shown/summed in, plus an optional pool of
-- additional_currencies for quick-select when the event
-- spans more than one country. A transaction can be entered
-- in a different currency than the event's primary one -
-- the conversion happens once at entry time and is locked
-- in (original_currency/original_amount_in_pence/
-- exchange_rate are stored purely for display), same as a
-- real receipt never changes after the fact even if rates
-- move later. amount_in_pence stays the only column every
-- balance calculation reads, always already converted to
-- the event's primary currency - nothing about
-- lib/balances.ts or the cross-event Balances screen
-- changes here.
-- -----------------------------------------------------

alter table public.events
add column if not exists primary_currency text not null default 'GBP';

alter table public.events
add column if not exists additional_currencies text[] not null default '{}';

alter table public.transactions
add column if not exists original_currency text;

alter table public.transactions
add column if not exists original_amount_in_pence integer;

alter table public.transactions
add column if not exists exchange_rate numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_original_amount_in_pence_positive'
  ) then
    alter table public.transactions
    add constraint transactions_original_amount_in_pence_positive
    check (
      original_amount_in_pence is null
      or original_amount_in_pence > 0
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_exchange_rate_positive'
  ) then
    alter table public.transactions
    add constraint transactions_exchange_rate_positive
    check (
      exchange_rate is null
      or exchange_rate > 0
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_original_currency_fields_together'
  ) then
    alter table public.transactions
    add constraint transactions_original_currency_fields_together
    check (
      (
        original_currency is null
        and original_amount_in_pence is null
        and exchange_rate is null
      )
      or (
        original_currency is not null
        and original_amount_in_pence is not null
        and exchange_rate is not null
      )
    );
  end if;
end $$;


-- -----------------------------------------------------
-- CREATE EVENT RPC - now takes the event's currency setup
--
-- The old 2-arg overload has to go, not just get replaced
-- in place: the new 4-arg version's extra params are
-- defaulted, so a 2-arg call becomes ambiguous between the
-- two overloads with both present. Same reasoning as
-- dropping edit_transaction's old signature below.
-- -----------------------------------------------------

drop function if exists public.create_event(text, text);

create or replace function public.create_event(
  p_name text,
  p_description text,
  p_primary_currency text default 'GBP',
  p_additional_currencies text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
  normalized_primary text;
  normalized_additional text[];
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  normalized_primary :=
    upper(trim(p_primary_currency));

  select coalesce(
    array_agg(distinct upper(trim(code))),
    '{}'
  )
  into normalized_additional
  from unnest(p_additional_currencies) as code
  where upper(trim(code)) <> normalized_primary;

  insert into public.events (
    name,
    description,
    created_by,
    primary_currency,
    additional_currencies
  )
  values (
    trim(p_name),
    coalesce(trim(p_description), ''),
    auth.uid(),
    normalized_primary,
    normalized_additional
  )
  returning id into new_event_id;

  insert into public.event_members (
    event_id,
    user_id
  )
  values (
    new_event_id,
    auth.uid()
  );

  return new_event_id;
end;
$$;

revoke execute
on function public.create_event(text, text, text, text[])
from public, anon, authenticated;

grant execute
on function public.create_event(text, text, text, text[])
to authenticated;


-- -----------------------------------------------------
-- EDIT TRANSACTION RPC - now accepts the original-currency
-- trio, all-or-nothing same as the table check constraint.
-- Same overload-ambiguity reasoning as create_event above:
-- the old 5-arg signature has to be dropped, not just
-- shadowed, since the new params are defaulted.
-- -----------------------------------------------------

drop function if exists public.edit_transaction(uuid, uuid, uuid, integer, text);

create or replace function public.edit_transaction(
  p_event_id uuid,
  p_transaction_id uuid,
  p_creditor_id uuid,
  p_amount_in_pence integer,
  p_description text,
  p_original_currency text default null,
  p_original_amount_in_pence integer default null,
  p_exchange_rate numeric default null
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

  if (
    p_original_currency is null
    and p_original_amount_in_pence is null
    and p_exchange_rate is null
  ) then
    -- entering in the event's own primary currency -
    -- nothing conversion-related to store
    null;
  elsif (
    p_original_currency is not null
    and p_original_amount_in_pence is not null
    and p_exchange_rate is not null
  ) then
    -- entered in a different currency - all three or
    -- nothing, same rule as the table's own check
    -- constraint, checked again here so the RPC fails
    -- with a clear message instead of a raw constraint
    -- violation
    null;
  else
    raise exception 'original_currency, original_amount_in_pence and exchange_rate must be provided together or not at all';
  end if;

  update public.transactions
  set
    creditor_id = p_creditor_id,
    amount_in_pence = p_amount_in_pence,
    description = trim(p_description),
    original_currency = p_original_currency,
    original_amount_in_pence = p_original_amount_in_pence,
    exchange_rate = p_exchange_rate
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
on function public.edit_transaction(uuid, uuid, uuid, integer, text, text, integer, numeric)
from public, anon, authenticated;

grant execute
on function public.edit_transaction(uuid, uuid, uuid, integer, text, text, integer, numeric)
to authenticated;
