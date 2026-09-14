-- -----------------------------------------------------
-- UK SPELLING - "finalize" to "finalise"
--
-- Same signature as before, only the exception text (which
-- surfaces directly to the user in the app) changes.
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
    raise exception 'Only the purchaser can finalise this receipt';
  end if;

  if v_receipt.status <> 'claiming' then
    raise exception 'This receipt has already been finalised or cancelled';
  end if;

  if (p_original_currency is null) <> (p_exchange_rate is null) then
    raise exception 'original_currency and exchange_rate must be provided together or not at all';
  end if;

  select count(*)
  into v_item_count
  from public.receipt_items
  where receipt_id = p_receipt_id;

  if v_item_count = 0 then
    raise exception 'This receipt has no items to finalise';
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
    raise exception 'Every item must be claimed before finalising';
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
