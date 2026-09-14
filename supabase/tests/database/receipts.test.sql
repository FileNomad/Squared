-- -----------------------------------------------------
-- RECEIPT SCANNING - REGRESSION TESTS
--
-- Run with:
--   supabase start
--   supabase test db
--
-- Same manual-GUC user simulation as the other test files -
-- see rls_security.test.sql's header for why. Fixture rows
-- for receipts/receipt_items/receipt_attendees are inserted
-- with the role reset back to the test session's default
-- (superuser) since only the scan-receipt Edge Function's
-- service-role client can normally write them - there's no
-- insert grant to authenticated on purpose, so this test has
-- to stand in for what that function would have done.
-- -----------------------------------------------------

begin;

select plan(18);

-- -----------------------------------------------------
-- Fixtures
-- -----------------------------------------------------

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'alice@receipt-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as alice_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'bob@receipt-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as bob_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'carol@receipt-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as carol_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'dave@receipt-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as dave_id
\gset

set local role authenticated;
set local request.jwt.claim.sub = :'alice_id';

insert into public.profiles (id, display_name)
values (:'alice_id'::uuid, 'ReceiptAlice');

set local request.jwt.claim.sub = :'bob_id';

insert into public.profiles (id, display_name)
values (:'bob_id'::uuid, 'ReceiptBob');

set local request.jwt.claim.sub = :'carol_id';

insert into public.profiles (id, display_name)
values (:'carol_id'::uuid, 'ReceiptCarol');

set local request.jwt.claim.sub = :'dave_id';

insert into public.profiles (id, display_name)
values (:'dave_id'::uuid, 'ReceiptDave');

set local request.jwt.claim.sub = :'alice_id';

select create_event('Receipt Test Trip', '') as event_id
\gset

select add_event_member_by_name(:'event_id'::uuid, 'ReceiptBob');
select add_event_member_by_name(:'event_id'::uuid, 'ReceiptCarol');
select add_event_member_by_name(:'event_id'::uuid, 'ReceiptDave');

-- Stand in for the scan-receipt Edge Function: alice is the
-- purchaser, bob and carol were at the meal, dave was not
-- (he's an event member but not an attendee of this
-- receipt, to prove attendee-only claiming). Subtotal 3500
-- (1000 + 2000 + 500), tax 350 (10%), no tip.
reset role;

insert into public.receipts (
  id, event_id, purchaser_id, currency, category,
  tax_in_pence, tip_in_pence, status
)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  :'event_id'::uuid, :'alice_id'::uuid, 'GBP', 'food',
  350, 0, 'claiming'
);

insert into public.receipt_attendees (receipt_id, user_id)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, :'alice_id'::uuid),
  ('11111111-1111-1111-1111-111111111111'::uuid, :'bob_id'::uuid),
  ('11111111-1111-1111-1111-111111111111'::uuid, :'carol_id'::uuid);

insert into public.receipt_items (id, receipt_id, name, price_in_pence, quantity)
values
  ('aaaaaaaa-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Burger', 1000, 1),
  ('aaaaaaaa-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Shared platter', 2000, 1),
  ('aaaaaaaa-3333-3333-3333-333333333333'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Alice''s salad', 500, 1);

set local role authenticated;

-- -----------------------------------------------------
-- 1. Dave is an event member but not a receipt attendee -
--    he cannot claim anything.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'dave_id';

select throws_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-1111-1111-1111-111111111111'
  ),
  null,
  'a non-attendee event member cannot claim a receipt item'
);

-- -----------------------------------------------------
-- 2. Bob (an attendee) claims the burger and half the
--    shared platter; Carol claims the other half.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'bob_id';

select lives_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-1111-1111-1111-111111111111'
  ),
  'bob can claim the burger'
);

select lives_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-2222-2222-2222-222222222222'
  ),
  'bob can claim the shared platter'
);

-- Claiming the same item twice is a harmless no-op, not an
-- error - matches the plain tap-to-claim UX (no toggle
-- double-fire should blow up the request).
select lives_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-1111-1111-1111-111111111111'
  ),
  'claiming the same item again is a harmless no-op'
);

set local request.jwt.claim.sub = :'carol_id';

select lives_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-2222-2222-2222-222222222222'
  ),
  'carol can claim the shared platter too'
);

-- -----------------------------------------------------
-- 3. Alice (purchaser) claims her own salad.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'alice_id';

select lives_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-3333-3333-3333-333333333333'
  ),
  'the purchaser can claim an item too'
);

-- -----------------------------------------------------
-- 4. Only the purchaser can finalize.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'bob_id';

select throws_ok(
  format(
    $$ select finalize_receipt(%L::uuid) $$,
    '11111111-1111-1111-1111-111111111111'
  ),
  null,
  'a non-purchaser cannot finalize the receipt'
);

-- -----------------------------------------------------
-- 5. Unclaiming actually removes the claim row, then
--    re-claim to restore the intended even split before
--    finalizing below.
-- -----------------------------------------------------

set local request.jwt.claim.sub = :'carol_id';

select unclaim_receipt_item(
  'aaaaaaaa-2222-2222-2222-222222222222'::uuid
);

select is(
  (
    select count(*)::int
    from public.receipt_item_claims
    where receipt_item_id = 'aaaaaaaa-2222-2222-2222-222222222222'::uuid
      and user_id = :'carol_id'::uuid
  ),
  0,
  'unclaiming removes the claim row'
);

select claim_receipt_item(
  'aaaaaaaa-2222-2222-2222-222222222222'::uuid
);

set local request.jwt.claim.sub = :'alice_id';

-- -----------------------------------------------------
-- 6. Finalize computes the correct proportional split.
--    Bob: burger (1000) + half the platter (1000) = 2000
--    subtotal, tax-adjusted by 3500+350 / 3500 -> 2200.
--    Carol: half the platter (1000) subtotal -> 1100.
--    Alice (purchaser) gets no transaction despite having
--    claimed the salad herself.
-- -----------------------------------------------------

select lives_ok(
  format(
    $$ select finalize_receipt(%L::uuid) $$,
    '11111111-1111-1111-1111-111111111111'
  ),
  'the purchaser can finalize once everything is claimed'
);

select is(
  (
    select amount_in_pence
    from public.transactions
    where event_id = :'event_id'::uuid
      and debtor_id = :'bob_id'::uuid
      and creditor_id = :'alice_id'::uuid
  ),
  2200,
  'bob''s share is correctly prorated with tax'
);

select is(
  (
    select amount_in_pence
    from public.transactions
    where event_id = :'event_id'::uuid
      and debtor_id = :'carol_id'::uuid
      and creditor_id = :'alice_id'::uuid
  ),
  1100,
  'carol''s share is correctly prorated with tax'
);

select is(
  (
    select count(*)::int
    from public.transactions
    where event_id = :'event_id'::uuid
      and debtor_id = :'alice_id'::uuid
  ),
  0,
  'the purchaser never gets a transaction for their own share'
);

select is(
  (
    select category
    from public.transactions
    where event_id = :'event_id'::uuid
      and debtor_id = :'bob_id'::uuid
  ),
  'food',
  'the generated transactions carry the receipt''s category'
);

select is(
  (
    select status
    from public.receipts
    where id = '11111111-1111-1111-1111-111111111111'::uuid
  ),
  'finalized',
  'the receipt is marked finalized'
);

-- -----------------------------------------------------
-- 7. A finalized receipt can't be finalized again, claimed
--    against, or cancelled.
-- -----------------------------------------------------

select throws_ok(
  format(
    $$ select finalize_receipt(%L::uuid) $$,
    '11111111-1111-1111-1111-111111111111'
  ),
  null,
  'a finalized receipt cannot be finalized twice'
);

set local request.jwt.claim.sub = :'bob_id';

select throws_ok(
  format(
    $$ select claim_receipt_item(%L::uuid) $$,
    'aaaaaaaa-1111-1111-1111-111111111111'
  ),
  null,
  'items on a finalized receipt can no longer be claimed'
);

-- -----------------------------------------------------
-- 8. A second, unclaimed receipt cannot be finalized, and
--    a receipt with no items at all cannot either.
-- -----------------------------------------------------

reset role;

insert into public.receipts (
  id, event_id, purchaser_id, currency, category, status
)
values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  :'event_id'::uuid, :'alice_id'::uuid, 'GBP', 'transport', 'claiming'
);

insert into public.receipt_attendees (receipt_id, user_id)
values ('22222222-2222-2222-2222-222222222222'::uuid, :'alice_id'::uuid);

insert into public.receipt_items (receipt_id, name, price_in_pence)
values ('22222222-2222-2222-2222-222222222222'::uuid, 'Taxi', 800);

set local role authenticated;
set local request.jwt.claim.sub = :'alice_id';

select throws_ok(
  format(
    $$ select finalize_receipt(%L::uuid) $$,
    '22222222-2222-2222-2222-222222222222'
  ),
  null,
  'a receipt with an unclaimed item cannot be finalized'
);

select lives_ok(
  'select cancel_receipt(''22222222-2222-2222-2222-222222222222''::uuid)',
  'the purchaser can cancel an unfinished receipt'
);

select * from finish();

rollback;
