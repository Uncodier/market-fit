-- List sites without going through sites/site_members RLS.
-- Direct SELECTs hang when those policies recurse through current_user_site_role.

CREATE OR REPLACE FUNCTION public.get_my_accessible_sites()
RETURNS SETOF public.sites
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.*
  FROM public.sites s
  WHERE s.user_id = auth.uid()
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
GRANT EXECUTE ON FUNCTION public.get_my_accessible_sites() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_accessible_sites() IS
  'Sites the current user owns or is an active member of. Bypasses RLS to avoid policy recursion.';
