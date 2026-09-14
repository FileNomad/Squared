-- -----------------------------------------------------
-- TRANSACTION CATEGORIES - REGRESSION TESTS
--
-- Run with:
--   supabase start
--   supabase test db
--
-- Same manual-GUC user simulation as the other test files -
-- see rls_security.test.sql's header for why.
-- -----------------------------------------------------

begin;

select plan(9);

-- -----------------------------------------------------
-- Fixtures
-- -----------------------------------------------------

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'alice@category-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as alice_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'bob@category-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as bob_id
\gset

set local role authenticated;
set local request.jwt.claim.sub = :'alice_id';

insert into public.profiles (id, display_name)
values (:'alice_id'::uuid, 'CategoryAlice');

set local request.jwt.claim.sub = :'bob_id';

insert into public.profiles (id, display_name)
values (:'bob_id'::uuid, 'CategoryBob');

set local request.jwt.claim.sub = :'alice_id';

select create_event('Category Test Event', '') as event_id
\gset

select add_event_member_by_name(:'event_id'::uuid, 'CategoryBob');

-- -----------------------------------------------------
-- 1. A transaction defaults to 'other' when no category
--    is given at all, matching every transaction created
--    before this feature shipped.
-- -----------------------------------------------------

select lives_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'No category given', 'confirmed'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  'a transaction with no category set is fine'
);

select is(
  (
    select category
    from public.transactions
    where description = 'No category given'
  ),
  'other',
  'category defaults to other'
);

-- -----------------------------------------------------
-- 2. Only the six known categories are accepted.
-- -----------------------------------------------------

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status, category
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Bad category', 'confirmed', 'gambling'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  null,
  'an unrecognised category is rejected'
);

-- -----------------------------------------------------
-- 3. A non-other category rejects having a custom label
--    at all. 'other' with no label is explicitly allowed
--    at the database level - the app requires a label when
--    someone actively picks Other, but that's enforced
--    client-side, not here, since every pre-existing
--    transaction backfills to exactly this: other, no
--    label.
-- -----------------------------------------------------

select lives_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status, category
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Other with no label', 'confirmed', 'other'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  'other without a custom label is allowed at the database level'
);

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status,
        category, category_custom_label
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Food with a label', 'confirmed',
        'food', 'Should not be allowed'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  null,
  'a non-other category with a custom label is rejected'
);

select lives_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status,
        category, category_custom_label
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Museum tickets', 'confirmed',
        'other', 'Museum tickets'
      )
    $$,
    :'event_id', :'alice_id', :'bob_id'
  ),
  'other with a proper custom label works'
);

-- -----------------------------------------------------
-- 4. edit_transaction enforces the same "no label outside
--    other" rule itself, with a readable error rather than
--    letting a raw constraint violation surface.
-- -----------------------------------------------------

select id as own_transaction_id
from public.transactions
where event_id = :'event_id'::uuid
  and debtor_id = :'alice_id'::uuid
  and description = 'No category given'
\gset

select throws_ok(
  format(
    $$
      select edit_transaction(
        %L::uuid, %L::uuid, %L::uuid, 2000, 'Edited badly',
        'transport', 'Should not be allowed'
      )
    $$,
    :'event_id', :'own_transaction_id', :'bob_id'
  ),
  null,
  'edit_transaction rejects a label on a non-other category'
);

select lives_ok(
  format(
    $$
      select edit_transaction(
        %L::uuid, %L::uuid, %L::uuid, 2000, 'Edited cleanly',
        'transport', null
      )
    $$,
    :'event_id', :'own_transaction_id', :'bob_id'
  ),
  'edit_transaction accepts a normal category change'
);

select is(
  (
    select category
    from public.transactions
    where id = :'own_transaction_id'::uuid
  ),
  'transport',
  'edit_transaction persists the new category'
);

select * from finish();

rollback;
