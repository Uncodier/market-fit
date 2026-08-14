-- 280000 still applied RLS to RETURN QUERY (FORCE ROW LEVEL SECURITY +
-- policies on auth.uid()), so the RPC succeeded with only the caller's row
-- and GET never fell back to the service role.

CREATE OR REPLACE FUNCTION public.get_my_site_members(p_site_id uuid)
RETURNS SETOF public.site_members
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  allowed boolean := false;
BEGIN
  IF uid IS NULL OR p_site_id IS NULL THEN
    RETURN;
  END IF;

  allowed := EXISTS (
    SELECT 1
    FROM public.sites s
    WHERE s.id = p_site_id
      AND s.user_id = uid
  );

  IF NOT allowed THEN
    allowed := EXISTS (
      SELECT 1
      FROM public.site_members sm
      WHERE sm.site_id = p_site_id
        AND sm.user_id = uid
    );
  END IF;

  IF NOT allowed THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sm.*
  FROM public.site_members sm
  WHERE sm.site_id = p_site_id
  ORDER BY sm.role DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_site_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_site_members(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_site_members(uuid) IS
  'All site_members for a site the current user owns or belongs to. Runs with row_security off so RLS cannot hide teammates.';

NOTIFY pgrst, 'reload schema';
