-- -----------------------------------------------------
-- MULTI-CURRENCY SUPPORT - REGRESSION TESTS
--
-- Run with:
--   supabase start
--   supabase test db
--
-- Same manual-GUC user simulation as the other test files -
-- see rls_security.test.sql's header for why.
-- -----------------------------------------------------

begin;

select plan(10);

-- -----------------------------------------------------
-- Fixtures
-- -----------------------------------------------------

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'alice@currency-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as alice_id
\gset

insert into auth.users (id, email, role, aud, instance_id)
values (
  gen_random_uuid(),
  'bob@currency-test.local',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
)
returning id as bob_id
\gset

set local role authenticated;
set local request.jwt.claim.sub = :'alice_id';

insert into public.profiles (id, display_name)
values (:'alice_id'::uuid, 'CurrencyAlice');

set local request.jwt.claim.sub = :'bob_id';

insert into public.profiles (id, display_name)
values (:'bob_id'::uuid, 'CurrencyBob');

set local request.jwt.claim.sub = :'alice_id';

-- -----------------------------------------------------
-- 1. create_event defaults to GBP when no currency is
--    passed at all, matching every event created before
--    this feature shipped.
-- -----------------------------------------------------

select create_event('No Currency Given', '') as default_event_id
\gset

select is(
  (
    select primary_currency
    from public.events
    where id = :'default_event_id'::uuid
  ),
  'GBP',
  'create_event defaults primary_currency to GBP'
);

-- -----------------------------------------------------
-- 2. create_event stores a chosen primary currency,
--    uppercased and trimmed, and dedupes/excludes it from
--    the additional currencies list even if the caller
--    passed it in both places with inconsistent casing.
-- -----------------------------------------------------

select create_event(
  'Multi Country Trip',
  '',
  ' eur ',
  array['usd', 'EUR', 'Usd', 'chf']
) as trip_event_id
\gset

select is(
  (
    select primary_currency
    from public.events
    where id = :'trip_event_id'::uuid
  ),
  'EUR',
  'primary_currency is trimmed and uppercased'
);

select is(
  (
    select array(
      select unnest(additional_currencies)
      order by 1
    )
    from public.events
    where id = :'trip_event_id'::uuid
  ),
  array['CHF', 'USD'],
  'additional_currencies is deduped, uppercased, and excludes the primary currency'
);

-- -----------------------------------------------------
-- 3. A transaction can be inserted with no original-
--    currency fields at all (entered directly in the
--    event's own primary currency).
-- -----------------------------------------------------

select add_event_member_by_name(:'trip_event_id'::uuid, 'CurrencyBob');

select lives_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        4500, 'Dinner in euros', 'confirmed'
      )
    $$,
    :'trip_event_id', :'alice_id', :'bob_id'
  ),
  'a transaction with no original-currency fields is fine'
);

-- -----------------------------------------------------
-- 4. A transaction can be inserted with all three
--    original-currency fields set together.
-- -----------------------------------------------------

select lives_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status,
        original_currency, original_amount_in_pence, exchange_rate
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        3800, 'Taxi entered in GBP', 'confirmed',
        'GBP', 3200, 1.1875
      )
    $$,
    :'trip_event_id', :'alice_id', :'bob_id'
  ),
  'a transaction with all three original-currency fields set is fine'
);

-- -----------------------------------------------------
-- 5. The table check constraint rejects a partial mix of
--    the three original-currency fields - this is the rule
--    the edit_transaction RPC below is also expected to
--    enforce itself before ever reaching this constraint.
-- -----------------------------------------------------

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status,
        original_currency
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Only currency set, missing the rest', 'confirmed',
        'GBP'
      )
    $$,
    :'trip_event_id', :'alice_id', :'bob_id'
  ),
  null,
  'a partial set of original-currency fields is rejected'
);

select throws_ok(
  format(
    $$
      insert into public.transactions (
        event_id, debtor_id, creditor_id,
        amount_in_pence, description, status,
        original_amount_in_pence, exchange_rate
      )
      values (
        %L::uuid, %L::uuid, %L::uuid,
        1000, 'Missing original_currency', 'confirmed',
        900, 1.1
      )
    $$,
    :'trip_event_id', :'alice_id', :'bob_id'
  ),
  null,
  'original_currency missing while the other two are set is also rejected'
);

-- -----------------------------------------------------
-- 6. edit_transaction enforces the same all-or-nothing
--    rule itself, with a readable error rather than
--    letting a raw constraint violation surface.
-- -----------------------------------------------------

select id as own_transaction_id
from public.transactions
where event_id = :'trip_event_id'::uuid
  and debtor_id = :'alice_id'::uuid
  and description = 'Dinner in euros'
\gset

select throws_ok(
  format(
    $$
      select edit_transaction(
        %L::uuid, %L::uuid, %L::uuid, 5000, 'Edited badly',
        'USD', null, null
      )
    $$,
    :'trip_event_id', :'own_transaction_id', :'bob_id'
  ),
  null,
  'edit_transaction rejects a partial original-currency trio'
);

select lives_ok(
  format(
    $$
      select edit_transaction(
        %L::uuid, %L::uuid, %L::uuid, 5000, 'Edited cleanly',
        'USD', 4200, 1.19
      )
    $$,
    :'trip_event_id', :'own_transaction_id', :'bob_id'
  ),
  'edit_transaction accepts the full original-currency trio'
);

select is(
  (
    select original_currency
    from public.transactions
    where id = :'own_transaction_id'::uuid
  ),
  'USD',
  'edit_transaction persists the original-currency trio'
);

select * from finish();

rollback;
