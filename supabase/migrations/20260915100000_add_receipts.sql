-- -----------------------------------------------------
-- RECEIPT SCANNING
--
-- A receipt is a mini-event within an event: the purchaser
-- scans a physical receipt, picks who was actually present,
-- and an AI vision call (from the scan-receipt Edge
-- Function, not from here - Postgres can't make outbound
-- HTTP calls) breaks it into line items. Only the picked
-- attendees can claim what they ordered; everyone in the
-- parent event can see the receipt and who's claimed what,
-- same visibility model as transactions elsewhere in this
-- schema. Finalizing turns claims into ordinary
-- `transactions` rows (one per attendee, purchaser
-- excluded - you don't owe yourself), so balance math,
-- multi-currency conversion, and the category breakdown
-- all keep working completely unchanged.
--
-- Every write to these four tables goes through either the
-- Edge Function (service role, for the initial AI-driven
-- insert) or a security definer RPC below - there are
-- deliberately no insert/update/delete grants to
-- authenticated on any of them, only select.
-- -----------------------------------------------------

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  purchaser_id uuid not null
    references public.profiles(id)
    on delete cascade,

  currency text not null,

  category text not null,

  category_custom_label text,

  tax_in_pence integer not null default 0
    check (tax_in_pence >= 0),

  tip_in_pence integer not null default 0
    check (tip_in_pence >= 0),

  status text not null default 'claiming'
    check (
      status in ('claiming', 'finalized', 'cancelled')
    ),

  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receipts_category_valid'
  ) then
    alter table public.receipts
    add constraint receipts_category_valid
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

  -- Same relaxed rule as transactions.category_custom_label:
  -- "other requires a label" is enforced client-side only,
  -- not here - the app always supplies both together, so the
  -- only thing worth blocking at the DB level is the
  -- nonsensical case of a label on a non-other category.
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receipts_category_custom_label_matches_other'
  ) then
    alter table public.receipts
    add constraint receipts_category_custom_label_matches_other
    check (
      category = 'other'
      or category_custom_label is null
    );
  end if;
end $$;


create table if not exists public.receipt_attendees (
  receipt_id uuid not null
    references public.receipts(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  primary key (receipt_id, user_id)
);


create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),

  receipt_id uuid not null
    references public.receipts(id)
    on delete cascade,

  name text not null,

  price_in_pence integer not null
    check (price_in_pence > 0),

  quantity integer not null default 1
    check (quantity > 0)
);


create table if not exists public.receipt_item_claims (
  receipt_item_id uuid not null
    references public.receipt_items(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  primary key (receipt_item_id, user_id)
);


-- -----------------------------------------------------
-- ROW LEVEL SECURITY
--
-- Select-only for everyone in the parent event - visibility
-- is deliberately the same for attendees and non-attendees.
-- Who can actually CLAIM is enforced inside
-- claim_receipt_item below, not by RLS on this table.
-- -----------------------------------------------------

alter table public.receipts
enable row level security;

drop policy if exists
"Event members can view receipts"
on public.receipts;

create policy "Event members can view receipts"
on public.receipts
for select
to authenticated
using (
  public.is_event_member(event_id)
);


alter table public.receipt_attendees
enable row level security;

drop policy if exists
"Event members can view receipt attendees"
on public.receipt_attendees;

create policy "Event members can view receipt attendees"
on public.receipt_attendees
for select
to authenticated
using (
  exists (
    select 1
    from public.receipts r
    where r.id = receipt_id
      and public.is_event_member(r.event_id)
  )
);


alter table public.receipt_items
enable row level security;

drop policy if exists
"Event members can view receipt items"
on public.receipt_items;

create policy "Event members can view receipt items"
on public.receipt_items
for select
to authenticated
using (
  exists (
    select 1
    from public.receipts r
    where r.id = receipt_id
      and public.is_event_member(r.event_id)
  )
);


alter table public.receipt_item_claims
enable row level security;

drop policy if exists
"Event members can view receipt item claims"
on public.receipt_item_claims;

create policy "Event members can view receipt item claims"
on public.receipt_item_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.id = receipt_item_id
      and public.is_event_member(r.event_id)
  )
);

-- Base table grants - RLS is only evaluated after this
-- check passes, so it's required even with the policies
-- above already correct. (Missing exactly this grant on
-- friendships is what broke the friends feature earlier in
-- this project - not repeating that here.)
grant select
on public.receipts,
   public.receipt_attendees,
   public.receipt_items,
   public.receipt_item_claims
to authenticated;


-- -----------------------------------------------------
-- CLAIM / UNCLAIM - the actual attendee-only enforcement.
-- -----------------------------------------------------

create or replace function public.claim_receipt_item(
  p_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt_id uuid;
  v_status text;
begin
  select ri.receipt_id, r.status
  into v_receipt_id, v_status
  from public.receipt_items ri
  join public.receipts r on r.id = ri.receipt_id
  where ri.id = p_item_id;

  if v_receipt_id is null then
    raise exception 'Receipt item not found';
  end if;

  if v_status <> 'claiming' then
    raise exception 'This receipt is no longer open for claiming';
  end if;

  if not exists (
    select 1
    from public.receipt_attendees
    where receipt_id = v_receipt_id
      and user_id = auth.uid()
  ) then
    raise exception 'Only attendees of this receipt can claim items';
  end if;

  insert into public.receipt_item_claims (
    receipt_item_id,
    user_id
  )
  values (
    p_item_id,
    auth.uid()
  )
  on conflict (receipt_item_id, user_id) do nothing;
end;
$$;

revoke execute
on function public.claim_receipt_item(uuid)
from public, anon, authenticated;

grant execute
on function public.claim_receipt_item(uuid)
to authenticated;


create or replace function public.unclaim_receipt_item(
  p_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select r.status
  into v_status
  from public.receipt_items ri
  join public.receipts r on r.id = ri.receipt_id
  where ri.id = p_item_id;

  if v_status is null then
    raise exception 'Receipt item not found';
  end if;

  if v_status <> 'claiming' then
    raise exception 'This receipt is no longer open for claiming';
  end if;

  delete from public.receipt_item_claims
  where receipt_item_id = p_item_id
    and user_id = auth.uid();
end;
$$;

revoke execute
on function public.unclaim_receipt_item(uuid)
from public, anon, authenticated;

grant execute
on function public.unclaim_receipt_item(uuid)
to authenticated;


-- -----------------------------------------------------
-- TAX / TIP CORRECTION - purchaser can fix the AI's
-- best-effort read before finalizing.
-- -----------------------------------------------------

create or replace function public.update_receipt_tax_tip(
  p_receipt_id uuid,
  p_tax_in_pence integer,
  p_tip_in_pence integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tax_in_pence < 0 or p_tip_in_pence < 0 then
    raise exception 'Tax and tip cannot be negative';
  end if;

  update public.receipts
  set
    tax_in_pence = p_tax_in_pence,
    tip_in_pence = p_tip_in_pence
  where id = p_receipt_id
    and purchaser_id = auth.uid()
    and status = 'claiming';

  if not found then
    raise exception 'Tax and tip can only be edited by the purchaser while the receipt is open for claiming';
  end if;
end;
$$;

revoke execute
on function public.update_receipt_tax_tip(uuid, integer, integer)
from public, anon, authenticated;

grant execute
on function public.update_receipt_tax_tip(uuid, integer, integer)
to authenticated;


-- -----------------------------------------------------
-- CANCEL - purchaser backs out, e.g. the AI misread the
-- receipt badly and they'd rather rescan than fix it by
-- hand.
-- -----------------------------------------------------

create or replace function public.cancel_receipt(
  p_receipt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.receipts
  set status = 'cancelled'
  where id = p_receipt_id
    and purchaser_id = auth.uid()
    and status = 'claiming';

  if not found then
    raise exception 'Receipt cannot be cancelled';
  end if;
end;
$$;

revoke execute
on function public.cancel_receipt(uuid)
from public, anon, authenticated;

grant execute
on function public.cancel_receipt(uuid)
to authenticated;


-- -----------------------------------------------------
-- FINALIZE - turns claims into ordinary transactions.
--
-- Each non-purchaser attendee's item subtotal is the sum,
-- over every item they claimed, of that item's price split
-- evenly across however many people claimed it (no manual
-- share input - tapping an item just means "count me in on
-- this one"). Tax and tip are prorated proportionally to
-- that subtotal share, not split evenly - someone who
-- ordered the $50 steak owes more of the tax than someone
-- who had a $10 side. The purchaser never gets a
-- transaction for their own share; they already paid for it
-- by definition.
-- -----------------------------------------------------

create or replace function public.finalize_receipt(
  p_receipt_id uuid,
  p_original_currency text default null,
  p_exchange_rate numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt record;
  v_item_subtotal_pence integer;
  v_unclaimed_count integer;
  v_item_count integer;
  v_attendee record;
  v_attendee_subtotal numeric;
  v_final_amount integer;
  v_converted_amount integer;
  v_description text;
begin
  select *
  into v_receipt
  from public.receipts
  where id = p_receipt_id;

  if v_receipt is null then
    raise exception 'Receipt not found';
  end if;

  if v_receipt.purchaser_id <> auth.uid() then
    raise exception 'Only the purchaser can finalize this receipt';
  end if;

  if v_receipt.status <> 'claiming' then
    raise exception 'This receipt has already been finalized or cancelled';
  end if;

  if (p_original_currency is null) <> (p_exchange_rate is null) then
    raise exception 'original_currency and exchange_rate must be provided together or not at all';
  end if;

  select count(*)
  into v_item_count
  from public.receipt_items
  where receipt_id = p_receipt_id;

  if v_item_count = 0 then
    raise exception 'This receipt has no items to finalize';
  end if;

  select count(*)
  into v_unclaimed_count
  from public.receipt_items ri
  where ri.receipt_id = p_receipt_id
    and not exists (
      select 1
      from public.receipt_item_claims c
      where c.receipt_item_id = ri.id
    );

  if v_unclaimed_count > 0 then
    raise exception 'Every item must be claimed before finalizing';
  end if;

  select coalesce(sum(price_in_pence), 0)
  into v_item_subtotal_pence
  from public.receipt_items
  where receipt_id = p_receipt_id;

  v_description := coalesce(
    v_receipt.category_custom_label,
    initcap(v_receipt.category)
  );

  for v_attendee in
    select user_id
    from public.receipt_attendees
    where receipt_id = p_receipt_id
      and user_id <> v_receipt.purchaser_id
  loop
    select coalesce(
      sum(
        ri.price_in_pence::numeric
        / claim_counts.claimant_count
      ),
      0
    )
    into v_attendee_subtotal
    from public.receipt_item_claims c
    join public.receipt_items ri
      on ri.id = c.receipt_item_id
    join (
      select
        receipt_item_id,
        count(*) as claimant_count
      from public.receipt_item_claims
      group by receipt_item_id
    ) claim_counts
      on claim_counts.receipt_item_id = ri.id
    where c.user_id = v_attendee.user_id
      and ri.receipt_id = p_receipt_id;

    if v_attendee_subtotal > 0 then
      v_final_amount := round(
        v_attendee_subtotal
        * (
          1
          + (v_receipt.tax_in_pence + v_receipt.tip_in_pence)::numeric
            / nullif(v_item_subtotal_pence, 0)
        )
      );

      v_converted_amount := case
        when p_exchange_rate is not null
          then round(v_final_amount * p_exchange_rate)
        else v_final_amount
      end;

      insert into public.transactions (
        event_id,
        debtor_id,
        creditor_id,
        amount_in_pence,
        description,
        status,
        category,
        category_custom_label,
        original_currency,
        original_amount_in_pence,
        exchange_rate
      )
      values (
        v_receipt.event_id,
        v_attendee.user_id,
        v_receipt.purchaser_id,
        v_converted_amount,
        v_description,
        'confirmed',
        v_receipt.category,
        v_receipt.category_custom_label,
        p_original_currency,
        case
          when p_original_currency is not null
            then v_final_amount
          else null
        end,
        p_exchange_rate
      );
    end if;
  end loop;

  update public.receipts
  set status = 'finalized'
  where id = p_receipt_id;
end;
$$;

revoke execute
on function public.finalize_receipt(uuid, text, numeric)
from public, anon, authenticated;

grant execute
on function public.finalize_receipt(uuid, text, numeric)
to authenticated;
