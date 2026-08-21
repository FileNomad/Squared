# Supabase schema

This directory is the version-controlled source of truth for the
Supabase project backing GroupFinance: tables, RLS policies, RPC
functions, Edge Functions, and database tests. Previously all of
this lived only in the Supabase dashboard.

## Applying migrations

Every file in `migrations/` is written to be idempotent (`create
table if not exists`, `drop policy if exists` + `create policy`,
`create or replace function`, `add column if not exists`), so it's
safe to run them against either a fresh project or the existing
live one - re-running an already-applied file is a no-op.

### Quick path: SQL Editor (no setup)

Open the SQL Editor in the Supabase dashboard and paste in
whichever migration file hasn't been applied yet, in filename
order. Nothing to install or link.

### Proper path: Supabase CLI (`supabase db push`)

One-time setup, if this repo isn't linked yet:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

(`<your-project-ref>` is the id in your project's dashboard URL,
`https://supabase.com/dashboard/project/<project-ref>`.)

```bash
npx supabase db push
```

`supabase migration list` shows which migrations are applied
locally vs. on the remote, if you want to check before pushing.

## Running the database tests

`tests/database/rls_security.test.sql` is a pgTAP suite that
exercises RLS policies and RPCs directly - things like "can a
non-creator delete someone else's event" or "can a user insert a
transaction that's already marked settled, skipping confirmation."
It needs a local Postgres, which the Supabase CLI provisions via
Docker:

```bash
supabase start
supabase test db
```

`supabase start` installs the `supabase_test_helpers` extension
these tests rely on (`tests.create_supabase_user()`,
`tests.authenticate_as()`) automatically the first time it runs.

## Deploying the Edge Function

```bash
supabase functions deploy delete-account
```

It expects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to be available in the function's
environment, which Supabase provides automatically for deployed
functions.
