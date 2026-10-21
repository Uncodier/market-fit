BEGIN;
SET LOCAL lock_timeout = '5s';

-- Existing self-service ownership INSERT/UPDATE policies are not authorization
-- to become a co-owner. current_user_site_role elevates an active member through
-- this relation, so unrestricted self-insertion bypasses every location denial.
CREATE FUNCTION public.location_acl_can_manage_ownership(p_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id = p_site_id
      AND s.user_id = auth.uid() AND s.archived_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.location_acl_can_manage_ownership(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.location_acl_can_manage_ownership(uuid) TO authenticated;

ALTER TABLE public.site_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_acl_ownership_insert ON public.site_ownership AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.location_acl_can_manage_ownership(site_id));
CREATE POLICY location_acl_ownership_update ON public.site_ownership AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.location_acl_can_manage_ownership(site_id))
  WITH CHECK (public.location_acl_can_manage_ownership(site_id));

-- Keep existing permissive grants and deletion behavior. Service-only ownership
-- provisioning retains its independently authorized contract; no existing rows
-- are removed or silently reclassified by this correction.
COMMIT;