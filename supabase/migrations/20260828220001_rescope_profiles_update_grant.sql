-- -----------------------------------------------------
-- 20260828210000 fixed a live grant gap (authenticated had
-- no INSERT/UPDATE at all on profiles) with a blanket
-- `grant insert, update on public.profiles to authenticated`.
-- That's broader than intended - it silently re-opened the
-- exact is_deleted self-mutation gap 20260816120004 closed by
-- scoping the grant to `update (display_name)` only. Caught
-- by rerunning the pgTAP suite against a full db reset, which
-- replays every migration in order including this drift.
--
-- Column-level grants aren't additive-safe across a blanket
-- re-grant, so revoke first and re-apply the narrower version.
-- -----------------------------------------------------

revoke insert, update
on public.profiles
from authenticated;

grant insert (id, display_name)
on public.profiles
to authenticated;

grant update (display_name)
on public.profiles
to authenticated;
