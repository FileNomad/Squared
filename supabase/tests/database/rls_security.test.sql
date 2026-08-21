-- -----------------------------------------------------
-- RLS / RPC SECURITY REGRESSION TESTS
--
-- NOT VERIFIED - written without being able to run them
-- (this environment has no Docker, and `supabase test db`
-- needs a local Postgres via `supabase start`). Read
-- through them before trusting a green run.
--
-- Run with:
--   supabase start
--   supabase test db
--
-- Requires the supabase_test_helpers extension, which
-- `supabase start` installs automatically in the local dev
-- database - it provides tests.create_supabase_user() and
-- tests.authenticate_as() to simulate different logged-in
-- users inside a single SQL script.
--
-- These encode the actual vulnerabilities found and fixed
-- this session, not a general audit of every RPC:
--   1. transactions could be inserted with any status,
--      bypassing the confirm/reject workflow entirely
--      (fixed in 20260816120004).
--   2. profiles.is_deleted could be set by a normal user
--      update, which force_resolve_stuck_transaction()
--      trusted as proof an account was really gone (fixed
--      in the same migration).
-- Plus a couple of the other core authorization checks as
-- general examples of the pattern, and one grant-privilege
-- check that doesn't depend on user simulation at all.
-- -----------------------------------------------------

begin;

select plan(13);

-- -----------------------------------------------------
-- Fixtures: three users, an event alice creates with bob
-- and carol as members.
-- -----------------------------------------------------

select tests.create_supabase_user('alice');
select tests.create_supabase_user('bob');
select tests.create_supabase_user('carol');

select tests.authenticate_as('alice');

insert into public.profiles (id, display_name)
values (tests.get_supabase_uid('alice'), 'Alice');

select tests.authenticate_as('bob');

insert into public.profiles (id, display_name)
values (tests.get_supabase_uid('bob'), 'Bob');

select tests.authenticate_as('carol');

insert into public.profiles (id, display_name)
values (tests.get_supabase_uid('carol'), 'Carol');

select tests.authenticate_as('alice');

select create_event('Test Trip', 'A test event') as event_id
\gset

select add_event_member_by_name(
  '{{event_id}}'::uuid,
  'Bob'
);

select add_event_member_by_name(
  '{{event_id}}'::uuid,
  'Carol'
);

-- -----------------------------------------------------
-- 1. Transactions can only ever be inserted as 'pending' -
--    this is the actual bug: any status was insertable.
-- -----------------------------------------------------

select tests.authenticate_as('alice');

select throws_ok(
  $$
    insert into public.transactions (
      event_id, debtor_id, creditor_id,
      amount_in_pence, description, status
    )
    values (
      '{{event_id}}'::uuid,
      tests.get_supabase_uid('alice'),
      tests.get_supabase_uid('bob'),
      1000,
      'Should be rejected',
      'settled'
    )
  $$,
  null,
  'cannot insert a transaction already marked settled'
);

select throws_ok(
  $$
    insert into public.transactions (
      event_id, debtor_id, creditor_id,
      amount_in_pence, description, status
    )
    values (
      '{{event_id}}'::uuid,
      tests.get_supabase_uid('alice'),
      tests.get_supabase_uid('bob'),
      1000,
      'Should be rejected',
      'confirmed'
    )
  $$,
  null,
  'cannot insert a transaction pre-confirmed, skipping the creditor''s approval'
);

select lives_ok(
  $$
    insert into public.transactions (
      event_id, debtor_id, creditor_id,
      amount_in_pence, description, status
    )
    values (
      '{{event_id}}'::uuid,
      tests.get_supabase_uid('alice'),
      tests.get_supabase_uid('bob'),
      1000,
      'Legit pending transaction',
      'pending'
    )
  $$,
  'a normal pending transaction insert still works'
);

-- -----------------------------------------------------
-- 2. Can't insert a transaction on someone else's behalf.
-- -----------------------------------------------------

select throws_ok(
  $$
    insert into public.transactions (
      event_id, debtor_id, creditor_id,
      amount_in_pence, description, status
    )
    values (
      '{{event_id}}'::uuid,
      tests.get_supabase_uid('bob'),
      tests.get_supabase_uid('carol'),
      500,
      'Alice pretending to be Bob',
      'pending'
    )
  $$,
  null,
  'cannot insert a transaction where you are not the debtor'
);

-- -----------------------------------------------------
-- 3. profiles.is_deleted cannot be self-set via a normal
--    update - only display_name is grantable. This is the
--    force_resolve_stuck_transaction trust issue.
-- -----------------------------------------------------

select throws_ok(
  $$
    update public.profiles
    set is_deleted = true
    where id = tests.get_supabase_uid('alice')
  $$,
  null,
  'cannot set your own is_deleted flag'
);

select lives_ok(
  $$
    update public.profiles
    set display_name = 'Alice Updated'
    where id = tests.get_supabase_uid('alice')
  $$,
  'can still update your own display_name'
);

select is(
  (
    select display_name
    from public.profiles
    where id = tests.get_supabase_uid('alice')
  ),
  'Alice Updated',
  'display_name change actually took effect'
);

-- -----------------------------------------------------
-- 4. Only the event creator can add members.
-- -----------------------------------------------------

select tests.authenticate_as('bob');

select throws_ok(
  $$
    select add_event_member_by_name(
      '{{event_id}}'::uuid,
      'Carol'
    )
  $$,
  null,
  'a non-creator member cannot add other members'
);

-- -----------------------------------------------------
-- 5. Only the creditor can confirm a pending transaction.
-- -----------------------------------------------------

select tests.authenticate_as('alice');

select add_event_member_by_name(
  '{{event_id}}'::uuid,
  'Bob'
);

select id as tx_id
from public.transactions
where event_id = '{{event_id}}'::uuid
  and debtor_id = tests.get_supabase_uid('alice')
  and creditor_id = tests.get_supabase_uid('bob')
  and status = 'pending'
limit 1
\gset

select throws_ok(
  format(
    $$ select confirm_transaction('%s'::uuid, '%s'::uuid) $$,
    '{{event_id}}',
    '{{tx_id}}'
  ),
  null,
  'the debtor cannot confirm their own transaction'
);

select tests.authenticate_as('bob');

select lives_ok(
  format(
    $$ select confirm_transaction('%s'::uuid, '%s'::uuid) $$,
    '{{event_id}}',
    '{{tx_id}}'
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

select tests.authenticate_as('bob');

delete from public.events
where id = '{{event_id}}'::uuid;

select ok(
  exists (
    select 1
    from public.events
    where id = '{{event_id}}'::uuid
  ),
  'a non-creator''s delete does not actually remove the event'
);

select tests.authenticate_as('alice');

delete from public.events
where id = '{{event_id}}'::uuid;

select ok(
  not exists (
    select 1
    from public.events
    where id = '{{event_id}}'::uuid
  ),
  'the actual creator can delete the event'
);

-- -----------------------------------------------------
-- 7. prepare_account_deletion must not be callable by a
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
