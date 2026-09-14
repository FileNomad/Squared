-- -----------------------------------------------------
-- SERVICE ROLE TABLE ACCESS
--
-- service_role has never had select/insert/update/delete on
-- any table in this schema - only the structural privileges
-- (references/trigger/truncate) that come along for free.
-- This never mattered before because the one existing Edge
-- Function (delete-account) only ever went through
-- SECURITY DEFINER RPCs and the Auth Admin API, neither of
-- which needs a table grant. scan-receipt is the first
-- function to query tables directly with the service-role
-- client, which is what surfaced this: "permission denied
-- for table event_members" even though service_role bypasses
-- RLS - bypassing RLS only skips the policies, not the
-- coarser table-level grant check underneath it, same
-- lesson as every other missing-grant bug in this project.
--
-- service_role is the fully-trusted, server-side-only role
-- by design (never exposed to a client, gated behind the
-- secret key), so granting it full access to every table
-- here is the correct posture, not something to scope down
-- table-by-table the way authenticated/anon are.
-- -----------------------------------------------------

grant select, insert, update, delete
on public.events,
   public.event_members,
   public.profiles,
   public.transactions,
   public.friendships,
   public.receipts,
   public.receipt_attendees,
   public.receipt_items,
   public.receipt_item_claims
to service_role;
