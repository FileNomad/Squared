-- -----------------------------------------------------
-- EVENTS
-- -----------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  description text not null default '',

  created_by uuid not null
    references public.profiles(id)
    on delete cascade,

  created_at timestamptz not null default now()
);


-- -----------------------------------------------------
-- EVENT MEMBERS
-- -----------------------------------------------------

create table if not exists public.event_members (
  event_id uuid not null
    references public.events(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  joined_at timestamptz not null default now(),

  primary key (event_id, user_id)
);


-- -----------------------------------------------------
-- TRANSACTIONS
-- -----------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.events(id)
    on delete cascade,

  debtor_id uuid not null
    references public.profiles(id),

  creditor_id uuid not null
    references public.profiles(id),

  amount_in_pence integer not null
    check (amount_in_pence > 0),

  description text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'rejected',
        'payment_pending',
        'settled'
      )
    ),

  created_at timestamptz not null default now(),

  check (debtor_id <> creditor_id)
);


-- -----------------------------------------------------
-- ENABLE RLS
-- -----------------------------------------------------

alter table public.events
enable row level security;

alter table public.event_members
enable row level security;

alter table public.transactions
enable row level security;


-- -----------------------------------------------------
-- HELPER FUNCTIONS
-- -----------------------------------------------------

create or replace function public.is_event_member(
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members
    where event_id = p_event_id
      and user_id = (select auth.uid())
  );
$$;


create or replace function public.is_user_event_member(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members
    where event_id = p_event_id
      and user_id = p_user_id
  );
$$;


create or replace function public.is_event_creator(
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events
    where id = p_event_id
      and created_by = (select auth.uid())
  );
$$;


-- Moved here from 20260816120000: this is a `language sql`
-- function, so its body is validated at CREATE FUNCTION
-- time and event_members has to already exist - it doesn't
-- yet at the point profiles.sql runs.
create or replace function public.shares_event_with_user(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.event_members mine
    join public.event_members theirs
      on theirs.event_id = mine.event_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;


-- -----------------------------------------------------
-- PROFILE RLS (continued from 20260816120000)
--
-- Replaces the self-only policy created there with the
-- real one, now that shares_event_with_user() above can
-- actually be defined.
-- -----------------------------------------------------

drop policy if exists
"Users can view relevant profiles"
on public.profiles;

create policy "Users can view relevant profiles"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.shares_event_with_user(id)
);


-- -----------------------------------------------------
-- EVENT RLS
-- -----------------------------------------------------

drop policy if exists
"Members can view events"
on public.events;

create policy "Members can view events"
on public.events
for select
to authenticated
using (
  public.is_event_member(id)
);

drop policy if exists
"Creators can delete events"
on public.events;

create policy "Creators can delete events"
on public.events
for delete
to authenticated
using (
  created_by = (select auth.uid())
);


-- -----------------------------------------------------
-- EVENT MEMBER RLS
-- -----------------------------------------------------

drop policy if exists
"Members can view event membership"
on public.event_members;

create policy "Members can view event membership"
on public.event_members
for select
to authenticated
using (
  public.is_event_member(event_id)
);


-- -----------------------------------------------------
-- TRANSACTION RLS
-- -----------------------------------------------------

drop policy if exists
"Members can view transactions"
on public.transactions;

create policy "Members can view transactions"
on public.transactions
for select
to authenticated
using (
  public.is_event_member(event_id)
);

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
);


-- -----------------------------------------------------
-- CREATE EVENT RPC
-- -----------------------------------------------------

create or replace function public.create_event(
  p_name text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  insert into public.events (
    name,
    description,
    created_by
  )
  values (
    trim(p_name),
    coalesce(trim(p_description), ''),
    auth.uid()
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


-- -----------------------------------------------------
-- ADD MEMBER BY DISPLAY NAME
-- -----------------------------------------------------

create or replace function public.add_event_member_by_name(
  p_event_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_event_creator(p_event_id) then
    raise exception 'Only the event creator can add members';
  end if;

  select id
  into target_user_id
  from public.profiles
  where lower(display_name) =
        lower(trim(p_display_name))
    and not is_deleted;

  if target_user_id is null then
    raise exception 'No user found with that display name';
  end if;

  insert into public.event_members (
    event_id,
    user_id
  )
  values (
    p_event_id,
    target_user_id
  )
  on conflict do nothing;
end;
$$;


-- -----------------------------------------------------
-- TRANSACTION STATE RPCs
-- -----------------------------------------------------

create or replace function public.confirm_transaction(
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
  set status = 'confirmed'
  where id = p_transaction_id
    and event_id = p_event_id
    and creditor_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Transaction cannot be confirmed';
  end if;
end;
$$;


create or replace function public.reject_transaction(
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
  set status = 'rejected'
  where id = p_transaction_id
    and event_id = p_event_id
    and creditor_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Transaction cannot be rejected';
  end if;
end;
$$;


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
  set status = 'payment_pending'
  where id = p_transaction_id
    and event_id = p_event_id
    and debtor_id = auth.uid()
    and status = 'confirmed';

  if not found then
    raise exception 'Transaction cannot be marked as paid';
  end if;
end;
$$;


create or replace function public.confirm_settlement(
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
    and creditor_id = auth.uid()
    and status = 'payment_pending';

  if not found then
    raise exception 'Settlement cannot be confirmed';
  end if;
end;
$$;


create or replace function public.reject_settlement(
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
  set status = 'confirmed'
  where id = p_transaction_id
    and event_id = p_event_id
    and creditor_id = auth.uid()
    and status = 'payment_pending';

  if not found then
    raise exception 'Settlement cannot be rejected';
  end if;
end;
$$;


-- -----------------------------------------------------
-- PERMISSIONS
-- -----------------------------------------------------

grant select, delete
on public.events
to authenticated;

grant select
on public.event_members
to authenticated;

grant select, insert
on public.transactions
to authenticated;

revoke update, delete
on public.transactions
from authenticated;

grant execute
on function public.create_event(text, text)
to authenticated;

grant execute
on function public.add_event_member_by_name(uuid, text)
to authenticated;

grant execute
on function public.confirm_transaction(uuid, uuid)
to authenticated;

grant execute
on function public.reject_transaction(uuid, uuid)
to authenticated;

grant execute
on function public.mark_transaction_paid(uuid, uuid)
to authenticated;

grant execute
on function public.confirm_settlement(uuid, uuid)
to authenticated;

grant execute
on function public.reject_settlement(uuid, uuid)
to authenticated;
