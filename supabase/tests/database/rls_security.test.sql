-- -----------------------------------------------------
-- RLS / RPC SECURITY REGRESSION TESTS
--
-- Run with:
--   supabase start
--   supabase test db
--
-- Simulates different logged-in users by setting the same
-- session GUC PostgREST sets per-request in production -
-- see auth.uid()'s own definition, which reads
-- request.jwt.claim.sub. Deliberately doesn't depend on the
-- supabase_test_helpers extension (tests.create_supabase_user
-- / tests.authenticate_as), since that isn't installed by a
-- stock `supabase start` and this suite should run without
-- extra setup.
--
-- These encode the actual vulnerabilities found and fixed
-- across this session, not a general audit of every RPC:
--   1. transactions could be inserted with any status,
--      bypassing the confirm/reject workflow entirely
--      (fixed in 20260816120004).
--   2. profiles.is_deleted could be set by a normal user
--      update, which force_resolve_stuck_transaction()
--      trusted as proof an account was really gone (fixed
--      in the same migration).
--   3. every function in the schema defaulted to PUBLIC
--      execute (a Postgres default for functions, not
--      something any grant statement here ever set) - a
--      local `supabase start` doesn't replicate whatever
--      the hosted platform does to prevent this, and this
--      suite is what caught it (fixed in 20260817140000).
--   4. is_user_event_member(event_id, user_id) let any
--      signed-in user probe any other user's membership in
--      any event, since it never checked the caller had a
--      legitimate connection to that event first (fixed in
--      20260817150000).
-- Plus a couple of the other core authorization checks as
-- general examples of the pattern, and one grant-privilege
-- check that doesn't depend on user simulation at all.
--
-- Fully verified as of this revision: run against a local
-- `supabase start` (Postgres via Docker), 15/15 passing.
-- -----------------------------------------------------

begin;

select plan(15);

-- -----------------------------------------------------
-- Fixtures: three real auth.users rows (required -
-- profiles.id has a foreign key to auth.users), their
-- profiles, and an event alice creates with bob and carol
-- as members.
-- -----------------------------------------------------

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'alice@rls-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as alice_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'bob@rls-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as bob_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'carol@rls-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as carol_id
\gset

set local role authenticated;
set local request.jwt.claim.sub = :'alice_id';

insert into public.profiles (id, display_name)
values (:'alice_id'::uuid, 'Alice');

set local request.jwt.claim.sub = :'bob_id';

insert into public.profiles (id, display_name)
values (:'bob_id'::uuid, 'Bob');

set local request.jwt.claim.sub = :'carol_id';

insert into public.profiles (id, display_name)
values (:'carol_id'::uuid, 'Carol');

set local request.jwt.claim.sub = :'alice_id';

select create_event('Test Trip', 'A test event') as event_id
\gset

select add_event_member_by_name(:'event_id'::uuid, 'Bob');
select add_event_member_by_name(:'event_id'::uuid, 'Carol');

-- -----------------------------------------------------
-- 1. Transactions can only ever be inserted as 'pending' -
--    this is the actual bug: any status was insertable.
-- -----------------------------------------------------

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Should be rejected', 'settled'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  null,
  'cannot insert a transaction already marked settled'
);

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Should be rejected', 'confirmed'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  null,
  'cannot insert a transaction pre-confirmed, skipping the creditor''s approval'
);

select lives_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Legit pending transaction', 'pending'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  'a normal pending transaction insert still works'
);

-- -----------------------------------------------------
-- 2. Can't insert a transaction on someone else's behalf.
-- -----------------------------------------------------

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        500, 'Alice pretending to be Bob', 'pending'
      )
    $$,
    :'event_id', :'bob_id', :'carol_id'
  ),
  null,
  'cannot insert a transaction where you are not the debtor'
);

-- -----------------------------------------------------
-- 3. profiles.is_deleted cannot be self-set via a normal
--    update - only display_name is grantable. This is the
--    force_resolve_stuck_transaction trust issue.
-- -----------------------------------------------------

select throws_ok(
  format(
    $$
      update public.profiles
      set is_deleted = true
      where id = %L::uuid
    $$,
    :'alice_id'
  ),
  null,
  'cannot set your own is_deleted flag'
);

select lives_ok(
  format(
    $$
      update public.profiles
      set display_name = 'Alice Updated'
      where id = %L::uuid
    $$,
    :'alice_id'
  ),
  'can still update your own display_name'
);

select is(
  (
    select display_name
    from public.profiles
    where id = :'alice_id'::uuid
  ),
  'Alice Updated',
  'display_name change actually took effect'
);

-- -----------------------------------------------------
-- 4. Only the event creator can add members.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'bob_id';

select throws_ok(
  format(
    $$ select add_event_member_by_name(%L::uuid, 'Carol') $$,
    :'event_id'
  ),
  null,
  'a non-creator member cannot add other members'
);

-- -----------------------------------------------------
-- 5. Only the creditor can confirm a pending transaction.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'alice_id';

select id as tx_id
from public.transactions
where event_id = :'event_id'::uuid
  and debtor_id = :'alice_id'::uuid
  and creditor_id = :'bob_id'::uuid
  and status = 'pending'
limit 1
\gset

select throws_ok(
  format(
    $$ select confirm_transaction(%L::uuid, %L::uuid) $$,
    :'event_id', :'tx_id'
  ),
  null,
  'the debtor cannot confirm their own transaction'
);

set local request.jwt.claim.sub = :'bob_id';

select lives_ok(
  format(
    $$ select confirm_transaction(%L::uuid, %L::uuid) $$,
    :'event_id', :'tx_id'
  ),
  'the actual creditor can confirm it'
);

-- -----------------------------------------------------
-- 6. Only the event creator can delete the event. RLS
--    doesn't throw on a DELETE that matches no visible
--    rows - it just deletes zero rows successfully - so
--    the real assertion is "the row is still there
--    afterward", not that the statement raises an error.
-- -----------------------------------------------------

delete from public.events
where id = :'event_id'::uuid;

select ok(
  exists (
    select 1
    from public.events
    where id = :'event_id'::uuid
  ),
  'a non-creator''s delete does not actually remove the event'
);

set local request.jwt.claim.sub = :'alice_id';

delete from public.events
where id = :'event_id'::uuid;

select ok(
  not exists (
    select 1
    from public.events
    where id = :'event_id'::uuid
  ),
  'the actual creator can delete the event'
);

-- -----------------------------------------------------
-- 7. is_user_event_member(event_id, user_id) must not let
--    an outsider probe someone else's membership in an
--    event they have no connection to. The previous event
--    was deleted above, so alice creates a second one with
--    just bob as a member - carol has no connection to it.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'alice_id';

select create_event(
  'Second Test Trip',
  'for the probing check'
) as event_id_2
\gset

select add_event_member_by_name(:'event_id_2'::uuid, 'Bob');

set local request.jwt.claim.sub = :'carol_id';

select is(
  is_user_event_member(:'event_id_2'::uuid, :'bob_id'::uuid),
  false,
  'an outsider with no connection to the event cannot probe another user''s membership'
);

set local request.jwt.claim.sub = :'alice_id';

select is(
  is_user_event_member(:'event_id_2'::uuid, :'bob_id'::uuid),
  true,
  'a real member can still correctly check another member''s membership'
);

-- -----------------------------------------------------
-- 8. prepare_account_deletion must not be callable by a
--    normal authenticated user - it trusts its p_user_id
--    argument completely and is only safe because the
--    delete-account Edge Function (using service_role) is
--    the sole caller.
-- -----------------------------------------------------

select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_account_deletion(uuid)',
    'execute'
  ),
  'authenticated role has no execute privilege on prepare_account_deletion'
);

select * from finish();

rollback;
