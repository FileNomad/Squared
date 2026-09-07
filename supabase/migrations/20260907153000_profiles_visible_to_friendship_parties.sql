-- -----------------------------------------------------
-- Mirrors shares_event_with_user(): resolving a friend or
-- friend-request's display name goes through a normal
-- `.from("profiles").select(...)` client call (same pattern
-- used everywhere else for names - event members, etc.),
-- which the profiles SELECT policy didn't account for.
-- Confirmed by actually driving the UI: a sent friend
-- request rendered as "Unknown" instead of the addressee's
-- name, since nothing you share an event with lets you see
-- their profile row otherwise. find_profile_by_friend_code
-- has its own security-definer bypass for the initial
-- lookup, but that only covers that one moment - the
-- friendships list needs to keep resolving names on every
-- later load too.
-- -----------------------------------------------------

create or replace function public.shares_friendship_with_user(
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
    from public.friendships
    where (
        requester_id = (select auth.uid())
        and addressee_id = p_user_id
      )
      or (
        requester_id = p_user_id
        and addressee_id = (select auth.uid())
      )
  );
$$;

revoke execute
on function public.shares_friendship_with_user(uuid)
from public, anon;

grant execute
on function public.shares_friendship_with_user(uuid)
to authenticated;

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
  or public.shares_friendship_with_user(id)
);
