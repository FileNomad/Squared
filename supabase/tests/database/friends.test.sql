-- -----------------------------------------------------
-- FRIENDS - RLS / RPC REGRESSION TESTS
--
-- Run with:
--   supabase start
--   supabase test db
--
-- Same manual-GUC user simulation as rls_security.test.sql -
-- see that file's header for why. Kept as its own file since
-- this is a big enough feature to read on its own.
-- -----------------------------------------------------

begin;

select plan(19);

-- -----------------------------------------------------
-- Fixtures
-- -----------------------------------------------------

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'alice@friends-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as alice_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'bob@friends-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as bob_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'carol@friends-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as carol_id
\gset

set local role authenticated;
set local request.jwt.claim.sub = :'alice_id';

insert into public.profiles (id, display_name)
values (:'alice_id'::uuid, 'FriendsAlice');

set local request.jwt.claim.sub = :'bob_id';

insert into public.profiles (id, display_name)
values (:'bob_id'::uuid, 'FriendsBob');

set local request.jwt.claim.sub = :'carol_id';

insert into public.profiles (id, display_name)
values (:'carol_id'::uuid, 'FriendsCarol');

set local request.jwt.claim.sub = :'bob_id';

select friend_code as bob_code
from public.profiles
where id = :'bob_id'::uuid
\gset

-- -----------------------------------------------------
-- 1. A profile gets a friend_code automatically, and it's
--    an 8-character code from the expected charset.
-- -----------------------------------------------------

select matches(
  :'bob_code'::text,
  '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$',
  'friend_code is auto-generated in the expected format'
);

-- -----------------------------------------------------
-- 2. find_profile_by_friend_code finds the right person by
--    exact code, excludes self, and finds nothing for a
--    made-up code - this is the identity-confirmation step
--    before sending a request.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'alice_id';

select is(
  (
    select display_name
    from find_profile_by_friend_code(:'bob_code')
  ),
  'FriendsBob',
  'looking up bob''s real code finds bob'
);

select is(
  (
    select count(*)::int
    from find_profile_by_friend_code('ZZZZZZZZ')
  ),
  0,
  'a made-up code finds nobody'
);

select is(
  (
    select count(*)::int
    from public.profiles p,
      lateral find_profile_by_friend_code(p.friend_code)
    where p.id = :'alice_id'::uuid
  ),
  0,
  'looking up your own code finds nobody (can''t friend yourself)'
);

-- -----------------------------------------------------
-- 3. send_friend_request creates a pending row, and sending
--    a second one while it's still pending is rejected
--    rather than creating a duplicate.
-- -----------------------------------------------------

select lives_ok(
  format(
    $$ select send_friend_request(%L::uuid) $$,
    :'bob_id'
  ),
  'alice can send bob a friend request'
);

select is(
  (
    select status
    from public.friendships
    where requester_id = :'alice_id'::uuid
      and addressee_id = :'bob_id'::uuid
  ),
  'pending',
  'the request is recorded as pending'
);

-- Resolving a friend/request's display name goes through a
-- normal profiles select (same as event member names do),
-- not through find_profile_by_friend_code - confirmed
-- necessary by actually driving the UI, where a sent request
-- rendered as "Unknown" without this.
select is(
  (
    select display_name
    from public.profiles
    where id = :'bob_id'::uuid
  ),
  'FriendsBob',
  'alice can see bob''s name for her outgoing request'
);

set local request.jwt.claim.sub = :'bob_id';

select is(
  (
    select display_name
    from public.profiles
    where id = :'alice_id'::uuid
  ),
  'FriendsAlice',
  'bob can see alice''s name for his incoming request'
);

set local request.jwt.claim.sub = :'alice_id';

select throws_ok(
  format(
    $$ select send_friend_request(%L::uuid) $$,
    :'bob_id'
  ),
  null,
  'sending a second request while one is already pending is rejected'
);

-- -----------------------------------------------------
-- 4. Only the addressee can respond to a request.
-- -----------------------------------------------------

select id as request_id
from public.friendships
where requester_id = :'alice_id'::uuid
  and addressee_id = :'bob_id'::uuid
\gset

set local request.jwt.claim.sub = :'carol_id';

select throws_ok(
  format(
    $$ select respond_to_friend_request(%L::uuid, true) $$,
    :'request_id'
  ),
  null,
  'someone who isn''t the addressee cannot respond to the request'
);

set local request.jwt.claim.sub = :'bob_id';

select lives_ok(
  format(
    $$ select respond_to_friend_request(%L::uuid, true) $$,
    :'request_id'
  ),
  'the actual addressee can accept it'
);

select is(
  (
    select status
    from public.friendships
    where id = :'request_id'::uuid
  ),
  'accepted',
  'the request is now accepted'
);

-- -----------------------------------------------------
-- 5. Once friends, sending another request is rejected as
--    already-friends rather than silently doing nothing.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'alice_id';

select throws_ok(
  format(
    $$ select send_friend_request(%L::uuid) $$,
    :'bob_id'
  ),
  null,
  'you cannot re-request someone you are already friends with'
);

-- -----------------------------------------------------
-- 6. Requesting each other at the same time auto-accepts
--    instead of leaving two crossed pending requests.
-- -----------------------------------------------------

select send_friend_request(:'carol_id'::uuid);

set local request.jwt.claim.sub = :'carol_id';

select send_friend_request(:'alice_id'::uuid);

select is(
  (
    select status
    from public.friendships
    where requester_id = :'alice_id'::uuid
      and addressee_id = :'carol_id'::uuid
  ),
  'accepted',
  'requesting each other at the same time auto-accepts'
);

-- -----------------------------------------------------
-- 7. remove_friend actually removes the friendship.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'alice_id';

select remove_friend(:'bob_id'::uuid);

select is(
  (
    select count(*)::int
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = :'alice_id'::uuid and addressee_id = :'bob_id'::uuid)
        or (requester_id = :'bob_id'::uuid and addressee_id = :'alice_id'::uuid)
      )
  ),
  0,
  'the friendship no longer exists after removing it'
);

-- -----------------------------------------------------
-- 8. add_event_member: only the event creator can use it,
--    same rule as add_event_member_by_name.
-- -----------------------------------------------------

select create_event('Friends Test Event', '') as event_id
\gset

select add_event_member_by_name(:'event_id'::uuid, 'FriendsCarol');

set local request.jwt.claim.sub = :'carol_id';

select throws_ok(
  format(
    $$ select add_event_member(%L::uuid, %L::uuid) $$,
    :'event_id', :'bob_id'
  ),
  null,
  'a non-creator cannot add a member via add_event_member'
);

set local request.jwt.claim.sub = :'alice_id';

select lives_ok(
  format(
    $$ select add_event_member(%L::uuid, %L::uuid) $$,
    :'event_id', :'bob_id'
  ),
  'the event creator can add a member directly by id'
);

-- -----------------------------------------------------
-- 9. New functions are locked down for anon, matching the
--    lesson from 20260828220000: this is what would have
--    caught that regression, so it's worth one direct check
--    here too rather than trusting the revoke statements by
--    inspection alone.
-- -----------------------------------------------------

select ok(
  not has_function_privilege(
    'anon',
    'public.send_friend_request(uuid)',
    'execute'
  ),
  'anon has no execute privilege on send_friend_request'
);

-- -----------------------------------------------------
-- 10. authenticated must have the base table-level SELECT
--     grant on friendships, not just the RLS policy. This is
--     the check that would have caught the real bug that
--     shipped: the RLS policy above was correct from day one,
--     but the grant itself was missing, so every client read
--     of this table failed with "permission denied for table
--     friendships" even though the RPCs above all worked (they
--     run as security definer and bypass grants). Note this
--     check alone didn't catch it locally, since local
--     Docker's default privileges happen to grant table access
--     that the hosted project doesn't - same gap already known
--     for function execute privileges. It's here so an
--     accidental future revoke shows up here instead of only
--     on a live device.
-- -----------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.friendships', 'select'),
  'authenticated has the base select grant on friendships'
);

select * from finish();

rollback;
