-- List sites without going through sites/site_members RLS.
-- Direct SELECTs can hang when those policies recurse through current_user_site_role.
-- The app loads workspaces via GET /api/sites (service role); this RPC remains
-- for SECURITY DEFINER callers and demo mocks.

DROP FUNCTION IF EXISTS public.get_my_accessible_sites();

CREATE FUNCTION public.get_my_accessible_sites()
RETURNS SETOF public.sites
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  SELECT s.*
  FROM public.sites s
  WHERE s.user_id = auth.uid()
     OR EXISTS (
       SELECT 1
       FROM public.site_ownership so
       WHERE so.site_id = s.id
         AND so.user_id = auth.uid()
     )
     OR EXISTS (
       SELECT 1
       FROM public.site_members sm
       WHERE sm.site_id = s.id
         AND sm.user_id = auth.uid()
         AND sm.status = 'active'
     );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_accessible_sites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_accessible_sites() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_my_accessible_sites() IS
  'Sites the current user owns or is an active member of. Bypasses RLS to avoid policy recursion.';

NOTIFY pgrst, 'reload schema';
