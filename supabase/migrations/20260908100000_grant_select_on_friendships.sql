-- The friendships table shipped with a correct RLS select policy but
-- no base-level SELECT grant to authenticated. RLS is only evaluated
-- after the table-level grant check passes, so every client read of
-- this table (the friends list, incoming/outgoing requests) has been
-- failing with "permission denied for table friendships" since the
-- friends feature shipped - the RPCs that write to this table still
-- worked fine since they're security definer and bypass grants, so
-- requests were sending and even auto-accepting correctly, just never
-- visible to either party. Same class of gap as the profiles upsert
-- and profiles-visibility fixes earlier in this project: the grant
-- and the policy are two separate checks, and both are required.

grant select on public.friendships to authenticated;
