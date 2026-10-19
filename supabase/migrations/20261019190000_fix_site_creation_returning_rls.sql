BEGIN;

-- INSERT ... RETURNING also checks SELECT policies before AFTER INSERT triggers.
-- The STABLE role lookup cannot see the new site in that statement's snapshot.
-- Authorize the primary owner from the row itself, as the INSERT policy does.
-- Keep the existing WITH CHECK, permissive policies and archive guard unchanged.
ALTER POLICY license_sites_access ON public.sites
  USING (user_id = (SELECT auth.uid()) OR public.current_user_site_role(id) IS NOT NULL);

NOTIFY pgrst, 'reload schema';

COMMIT;