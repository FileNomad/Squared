-- -----------------------------------------------------
-- ACCOUNT DELETION
--
-- Called by the delete-account Edge Function
-- (supabase/functions/delete-account) using the
-- service_role key, after it has independently verified
-- the caller's JWT and re-checked their password.
--
-- Deliberately NOT granted to `authenticated` or `anon`:
-- it trusts p_user_id without checking it against
-- auth.uid(), because the Edge Function is the only
-- caller and has already done that verification. Do not
-- add a grant here without adding that check first.
-- -----------------------------------------------------

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
  -- pending: this user (as creditor) never confirmed the
  -- debt was real. Nobody can confirm it on their behalf,
  -- and rejecting it doesn't assert anything false about
  -- money changing hands, so it's safe to auto-reject.
  --
  -- confirmed and payment_pending transactions are
  -- deliberately left untouched here: forcing them to
  -- 'settled' would assert a payment nobody actually
  -- confirmed. Those are resolved by the event creator via
  -- force_resolve_stuck_transaction() instead - see
  -- 0004_force_resolve_stuck_transactions.sql.
  --
  update public.transactions
  set status = 'rejected'
  where creditor_id = p_user_id
    and status = 'pending';

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
