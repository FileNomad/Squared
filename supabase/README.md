# Supabase schema

This directory is the version-controlled source of truth for the
Supabase project backing GroupFinance: tables, RLS policies, RPC
functions, and Edge Functions. Previously all of this lived only in
the Supabase dashboard.

## Applying migrations

Every file in `migrations/` is written to be idempotent (`create
table if not exists`, `drop policy if exists` + `create policy`,
`create or replace function`, `add column if not exists`), so it's
safe to run them against either a fresh project or the existing
live one - re-running an already-applied file is a no-op.

**Only `20260816120003_force_resolve_stuck_transactions.sql` is
new** as of this cleanup - the other three reproduce what's
already live. That file has not been run against the live project
yet, and needs to be for the "resolve a transaction stuck on a
deleted member" fix to work.

### Quick path: SQL Editor (no setup)

Since the earlier files are already applied by hand, the fastest
way to ship just the fix is to open the SQL Editor in the Supabase
dashboard and paste in
`20260816120003_force_resolve_stuck_transactions.sql`. Nothing to
install or link.

### Proper path: Supabase CLI (`supabase db push`)

This repo has never been linked to a Supabase project via the CLI,
so `supabase db push` will not work out of the box yet. One-time
setup:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

(`<your-project-ref>` is the id in your project's dashboard URL,
`https://supabase.com/dashboard/project/<project-ref>`.)

Because the first three migrations were applied by hand rather
than through the CLI, your project's remote migration history has
no record of them - `supabase db push` will try to apply all four
files, not just the new one. That's safe here since every file is
idempotent, but it's worth knowing before you run it rather than
being surprised. After the first `db push`, the CLI's remote
history is in sync and future pushes will only apply what's
actually new.

```bash
npx supabase db push
```

## Deploying the Edge Function

```bash
supabase functions deploy delete-account
```

It expects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to be available in the function's
environment, which Supabase provides automatically for deployed
functions.
