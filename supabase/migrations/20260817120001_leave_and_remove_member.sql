-- -----------------------------------------------------
-- LEAVE EVENT / REMOVE MEMBER
--
-- Both are blocked while the member has an unresolved
-- transaction (pending, confirmed, or payment_pending) in
-- the event. This isn't just UX - it closes off the same
-- class of gap that force_resolve_stuck_transaction's
-- is_deleted trust check had: without this, a debtor on a
-- real confirmed debt could just leave the event to make
-- themselves "unreachable" and get the creator to force-
-- settle it, exactly like the is_deleted self-mutation
-- issue fixed in 20260816120004. Settle up before leaving.
--
-- Neither lets the event creator remove/leave themselves -
-- deleting the event is the only way to walk away from an
-- event you created.
-- -----------------------------------------------------

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
      and status in (
        'pending',
        'confirmed',
        'payment_pending'
      )
  ) then
    raise exception 'Resolve your open transactions in this event before leaving';
  end if;

  delete from public.event_members
  where event_id = p_event_id
    and user_id = auth.uid();
end;
$$;

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
      and status in (
        'pending',
        'confirmed',
        'payment_pending'
      )
  ) then
    raise exception 'This member has open transactions in this event and cannot be removed yet';
  end if;

  delete from public.event_members
  where event_id = p_event_id
    and user_id = p_user_id;
end;
$$;

grant execute
on function public.leave_event(uuid)
to authenticated;

grant execute
on function public.remove_event_member(uuid, uuid)
to authenticated;
