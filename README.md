# GroupFinance

A group expense tracker for splitting shared costs and settling debts with friends — think "who owes who" for a trip, a house share, or any recurring group expense. Built with React Native (Expo) and Supabase (Postgres, Auth, Edge Functions).

Every debt goes through an explicit two-party confirmation workflow (propose → confirm/reject → mark paid → confirm/reject settlement) rather than just being written down — nothing is treated as real money owed until both people have agreed to it.

## Features

- **Auth**: email/password sign-up with email confirmation, forgot-password flow, account deletion (soft-deleted so shared history with other members survives).
- **Events**: create a shared event, add registered members by display name, per-event and cross-event balance views.
- **Transactions**: propose a debt, the other party confirms or rejects it, the debtor marks it paid, the creditor confirms or disputes receipt. Debtors can edit or cancel a transaction while it's still pending.
- **Membership**: leave an event or (as the creator) remove a member — blocked while that person has an unresolved transaction in the event, so debts can't be dodged by disappearing.
- **Dark mode**: system-following by default, with a manual light/dark/system override in Account.

## Tech stack

- **Client**: Expo / React Native, TypeScript, Expo Router (file-based navigation with guarded route groups)
- **Backend**: Supabase — Postgres with Row Level Security, `security definer` RPC functions for every state-changing action, one Edge Function (account deletion, which independently re-verifies the caller's password server-side before doing anything)
- **Testing**: Jest for client-side logic, pgTAP for database/RLS behaviour (see [supabase/README.md](supabase/README.md))

## Why the backend is worth a look

Nothing here trusts the client. Every table has Row Level Security enabled and every mutation goes through a Postgres function that re-derives authorization from `auth.uid()` rather than trusting anything the client sends — e.g. a transaction can only ever be inserted as `pending`, and only the creditor's own confirmation can move it to `confirmed`. The full schema, policies, and RPCs are version-controlled in [supabase/migrations](supabase/migrations), applied incrementally rather than as one dump, with each migration's commit explaining what it changed and why.

The [pgTAP suite](supabase/tests/database/rls_security.test.sql) attacks the database directly — inserting a transaction as an unauthorized status, trying to confirm someone else's transaction, trying to delete someone else's event — and asserts each attempt correctly fails. It's run against a real local Postgres via Docker, not mocked.

## Getting started

```bash
npm install
npx expo start
```

Then open the result in [Expo Go](https://expo.dev/go), an iOS/Android simulator, or a web browser. You'll need your own Supabase project — copy `.env.example` to `.env` and fill in your project's URL and anon key, then apply the migrations in [supabase/migrations](supabase/migrations) (see [supabase/README.md](supabase/README.md) for exact steps).

## Testing

Client-side unit tests:

```bash
npm test
```

Database/RLS tests (pgTAP, needs Docker Desktop):

```bash
npx supabase start
npx supabase test db
```

See [supabase/README.md](supabase/README.md) for details on both the migrations and the test suite.

## Project structure

```
app/                   Screens (Expo Router file-based routing)
components/ui/         Shared design-system primitives (Button, Card, TextField, ...)
constants/theme.ts     Color tokens (light/dark), spacing, type scale
context/                AuthContext, EventContext, ThemeContext
lib/                    Pure business logic (balance calculations) + Supabase client setup
supabase/migrations/   Version-controlled schema, RLS policies, RPC functions
supabase/functions/    Edge Functions
supabase/tests/         pgTAP database tests
```
