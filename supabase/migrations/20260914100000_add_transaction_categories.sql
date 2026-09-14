-- -----------------------------------------------------
-- TRANSACTION CATEGORIES
--
-- Every transaction gets a category from a fixed set, so
-- the event screen can show a spend breakdown. The app
-- requires a custom label when the user actively picks
-- 'other' (enforced client-side, same as description
-- already being required - not every content rule here is
-- a hard DB constraint). That can't be a table-level check
-- constraint though: this column backfills every existing
-- transaction to 'other' with no label, and a constraint
-- requiring one would reject that backfill outright. The
-- constraint below only rules out the nonsensical case of a
-- label attached to a non-other category.
-- -----------------------------------------------------

alter table public.transactions
add column if not exists category text not null default 'other';

alter table public.transactions
add column if not exists category_custom_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_category_valid'
  ) then
    alter table public.transactions
    add constraint transactions_category_valid
    check (
      category in (
        'food',
        'transport',
        'accommodation',
        'bills',
        'entertainment',
        'other'
      )
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_category_custom_label_matches_other'
  ) then
    alter table public.transactions
    add constraint transactions_category_custom_label_matches_other
    check (
      category = 'other'
      or category_custom_label is null
    );
  end if;
end $$;


-- -----------------------------------------------------
-- EDIT TRANSACTION RPC - now also takes the category and,
-- when it's 'other', the custom label. Same reasoning as
-- the currency trio: the old signature has to be dropped,
-- not just shadowed, since the new params are defaulted.
-- -----------------------------------------------------

drop function if exists public.edit_transaction(uuid, uuid, uuid, integer, text, text, integer, numeric);

create or replace function public.edit_transaction(
  p_event_id uuid,
  p_transaction_id uuid,
  p_creditor_id uuid,
  p_amount_in_pence integer,
  p_description text,
  p_category text default 'other',
  p_category_custom_label text default null,
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

  if p_category not in (
    'food',
    'transport',
    'accommodation',
    'bills',
    'entertainment',
    'other'
  ) then
    raise exception 'Unknown transaction category';
  end if;

  if (
    p_category <> 'other'
    and p_category_custom_label is not null
  ) then
    raise exception 'A custom label can only be set when the category is Other';
  end if;

  if (
    p_original_currency is null
    and p_original_amount_in_pence is null
    and p_exchange_rate is null
  ) then
    null;
  elsif (
    p_original_currency is not null
    and p_original_amount_in_pence is not null
    and p_exchange_rate is not null
  ) then
    null;
  else
    raise exception 'original_currency, original_amount_in_pence and exchange_rate must be provided together or not at all';
  end if;

  update public.transactions
  set
    creditor_id = p_creditor_id,
    amount_in_pence = p_amount_in_pence,
    description = trim(p_description),
    category = p_category,
    category_custom_label = p_category_custom_label,
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
on function public.edit_transaction(uuid, uuid, uuid, integer, text, text, text, text, integer, numeric)
from public, anon, authenticated;

grant execute
on function public.edit_transaction(uuid, uuid, uuid, integer, text, text, text, text, integer, numeric)
to authenticated;
