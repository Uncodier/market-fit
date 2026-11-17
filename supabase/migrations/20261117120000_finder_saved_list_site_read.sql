BEGIN;

-- Saved Finder lists belong to their site, even without a segment association.
-- Retain existing write policies and restrictive location/anonymous guards.
DROP POLICY IF EXISTS "icp_mining - authenticated can select in site" ON public.icp_mining;
DROP POLICY IF EXISTS "icp_mining - authenticated can select by site" ON public.icp_mining;
CREATE POLICY "icp_mining - authenticated can select by site"
ON public.icp_mining FOR SELECT TO authenticated
USING (
  site_id IS NOT NULL
  AND public.user_can(site_id, 'select')
  AND public.current_user_has_site_location_restrictions(site_id) IS NOT DISTINCT FROM false
);

-- A query can be reused by multiple sites; segment links cannot grant access
-- to another site's mining run through any remaining permissive policy.
DROP POLICY IF EXISTS "icp_mining - authenticated select site boundary" ON public.icp_mining;
CREATE POLICY "icp_mining - authenticated select site boundary"
ON public.icp_mining AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  site_id IS NOT NULL
  AND public.user_can(site_id, 'select')
  AND public.current_user_has_site_location_restrictions(site_id) IS NOT DISTINCT FROM false
);

COMMIT;