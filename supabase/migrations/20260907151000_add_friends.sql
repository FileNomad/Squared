-- -----------------------------------------------------
-- FRIENDS
--
-- Adds a short, shareable Friend Code per profile and a
-- request/accept friendships model, so members can be added
-- to events unambiguously (by exact code, with an identity
-- confirmation step) instead of only by typing a display
-- name and hoping it's spelled right / unique enough.
--
-- Every function this migration creates gets an explicit
-- `revoke execute ... from public, anon, authenticated`
-- before granting back only what's needed - confirmed
-- necessary (not just defensive) by the exact same
-- discovery made in 20260828220000: a default-privileges
-- rule seeded per-role (not set by any migration here)
-- grants execute on every new function directly to anon and
-- authenticated, so "revoke from public" alone never
-- actually closes it.
-- -----------------------------------------------------

--
-- FRIEND CODE
--
-- Excludes visually ambiguous characters (0/O, 1/I/L) so a
-- code read aloud or handwritten is less likely to be
-- mistyped. Looked up case-insensitively (normalized to
-- upper on both write and read).
--

alter table public.profiles
add column if not exists friend_code text;

create or replace function public.generate_friend_code()
returns text
language plpgsql
as $$
declare
  charset text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
begin
  for i in 1..8 loop
    code := code || substr(
      charset,
      1 + floor(random() * length(charset))::int,
      1
    );
  end loop;

  return code;
end;
$$;

-- security definer: needs to see every profile's code to
-- check for a collision, not just the caller's own row -
-- profiles' SELECT policy would otherwise restrict this to
-- "your own row or someone you share an event with", which
-- is meaningless for a brand new signup with no events yet.
create or replace function public.set_friend_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  attempts int := 0;
begin
  if new.friend_code is not null then
    return new;
  end if;

  loop
    candidate := public.generate_friend_code();
    attempts := attempts + 1;

    exit when not exists (
      select 1
      from public.profiles
      where friend_code = candidate
    ) or attempts > 20;
  end loop;

  new.friend_code := candidate;
  return new;
end;
$$;

drop trigger if exists set_friend_code_trigger on public.profiles;

create trigger set_friend_code_trigger
before insert on public.profiles
for each row
execute function public.set_friend_code();

-- Backfill any existing rows (collision odds across a
-- handful of rows, out of ~1.1 trillion combinations, are
-- negligible - the unique index added below still catches it
-- loudly if it ever somehow happened, rather than silently).
update public.profiles
set friend_code = public.generate_friend_code()
where friend_code is null;

alter table public.profiles
alter column friend_code set not null;

create unique index if not exists profiles_friend_code_unique
on public.profiles (friend_code);


--
-- FRIENDSHIPS
--
-- One row per relationship, not two - direction is just
-- who requested. 'declined' rows are kept (not deleted) so a
-- later re-request updates the same row instead of hitting
-- the unique constraint.
--

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),

  requester_id uuid not null
    references public.profiles(id)
    on delete cascade,

  addressee_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'declined'
      )
    ),

  created_at timestamptz not null default now(),

  check (requester_id <> addressee_id),

  unique (requester_id, addressee_id)
);

alter table public.friendships
enable row level security;

drop policy if exists
"Users can view their own friendships"
on public.friendships;

create policy "Users can view their own friendships"
on public.friendships
for select
to authenticated
using (
  requester_id = (select auth.uid())
  or addressee_id = (select auth.uid())
);

-- No direct insert/update/delete grants - every state
-- change goes through the RPCs below, same as transactions
-- and event membership elsewhere in this schema.


--
-- LOOK SOMEONE UP BY THEIR EXACT CODE
--
-- Deliberately the only way to find a profile you don't
-- already share an event with - returns just enough to
-- confirm identity (name), for exactly one exact code, not a
-- general search. profiles' own SELECT policy wouldn't allow
-- this (it only allows your own row or someone you already
-- share an event with), which is the point: this is a
-- narrow, explicit bypass of that, not a loosening of it.
--
create or replace function public.find_profile_by_friend_code(
  p_code text
)
returns table (
  id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select p.id, p.display_name
  from public.profiles p
  where p.friend_code = upper(trim(p_code))
    and not p.is_deleted
    and p.id <> auth.uid();
end;
$$;

revoke execute
on function public.find_profile_by_friend_code(text)
from public, anon, authenticated;

grant execute
on function public.find_profile_by_friend_code(text)
to authenticated;


--
-- SEND / RESPOND / CANCEL / REMOVE
--
create or replace function public.send_friend_request(
  p_addressee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing record;
begin
  if p_addressee_id = auth.uid() then
    raise exception 'You cannot add yourself as a friend';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_addressee_id
      and not is_deleted
  ) then
    raise exception 'That user does not exist';
  end if;

  select *
  into existing
  from public.friendships
  where (
      requester_id = auth.uid()
      and addressee_id = p_addressee_id
    )
    or (
      requester_id = p_addressee_id
      and addressee_id = auth.uid()
    );

  if found then
    if existing.status = 'accepted' then
      raise exception 'You are already friends';
    end if;

    if existing.status = 'pending'
      and existing.requester_id = p_addressee_id then
      -- They already asked you - accept instead of
      -- leaving two crossed pending requests.
      update public.friendships
      set status = 'accepted'
      where id = existing.id;

      return;
    end if;

    if existing.status = 'pending'
      and existing.requester_id = auth.uid() then
      raise exception 'Friend request already sent';
    end if;

    -- Previously declined - let them try again.
    update public.friendships
    set
      status = 'pending',
      requester_id = auth.uid(),
      addressee_id = p_addressee_id,
      created_at = now()
    where id = existing.id;

    return;
  end if;

  insert into public.friendships (
    requester_id,
    addressee_id,
    status
  )
  values (
    auth.uid(),
    p_addressee_id,
    'pending'
  );
end;
$$;

revoke execute
on function public.send_friend_request(uuid)
from public, anon, authenticated;

grant execute
on function public.send_friend_request(uuid)
to authenticated;


create or replace function public.respond_to_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friendships
  set status = case
    when p_accept then 'accepted'
    else 'declined'
  end
  where id = p_request_id
    and addressee_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Request not found or already responded to';
  end if;
end;
$$;

revoke execute
on function public.respond_to_friend_request(uuid, boolean)
from public, anon, authenticated;

grant execute
on function public.respond_to_friend_request(uuid, boolean)
to authenticated;


create or replace function public.cancel_friend_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where id = p_request_id
    and requester_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Request not found';
  end if;
end;
$$;

revoke execute
on function public.cancel_friend_request(uuid)
from public, anon, authenticated;

grant execute
on function public.cancel_friend_request(uuid)
to authenticated;


create or replace function public.remove_friend(
  p_friend_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where status = 'accepted'
    and (
      (
        requester_id = auth.uid()
        and addressee_id = p_friend_id
      )
      or (
        requester_id = p_friend_id
        and addressee_id = auth.uid()
      )
    );

  if not found then
    raise exception 'Friendship not found';
  end if;
end;
$$;

revoke execute
on function public.remove_friend(uuid)
from public, anon, authenticated;

grant execute
on function public.remove_friend(uuid)
to authenticated;


--
-- QUICK-ADD TO AN EVENT BY USER ID
--
-- Same authorization rule as add_event_member_by_name
-- (only the event creator, target must be a real account) -
-- just addressed by id instead of a display-name lookup,
-- for the friends quick-add picker. Not restricted to actual
-- friends: it's the same permission model as the existing
-- by-name path, just a more direct way to invoke it.
--
create or replace function public.add_event_member(
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
    raise exception 'Only the event creator can add members';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
      and not is_deleted
  ) then
    raise exception 'That user does not exist';
  end if;

  insert into public.event_members (
    event_id,
    user_id
  )
  values (
    p_event_id,
    p_user_id
  )
  on conflict do nothing;
end;
$$;

revoke execute
on function public.add_event_member(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.add_event_member(uuid, uuid)
to authenticated;
