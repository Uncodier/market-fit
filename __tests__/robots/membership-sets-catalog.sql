-- Read-only deployed catalog, 2026-11-26. Synthetic fixture policies only.
ALTER POLICY site_members_final_policy ON public.site_members USING (
  user_id=(SELECT auth.uid()) OR site_id IN (
    SELECT site_ownership.site_id FROM public.site_ownership
    WHERE site_ownership.user_id=(SELECT auth.uid()))
);
CREATE POLICY remote_instances_access_policy ON public.remote_instances USING (
  current_setting('role',true)='service_role' OR auth.jwt()->>'role'='service_role'
  OR EXISTS (SELECT 1 FROM public.sites s WHERE s.id=remote_instances.site_id AND (
    s.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.site_ownership so
      WHERE so.site_id=s.id AND so.user_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.site_members sm
      WHERE sm.site_id=s.id AND sm.user_id=auth.uid() AND sm.status='active')))
) WITH CHECK (
  current_setting('role',true)='service_role' OR auth.jwt()->>'role'='service_role'
  OR EXISTS (SELECT 1 FROM public.sites s WHERE s.id=remote_instances.site_id AND (
    s.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.site_ownership so
      WHERE so.site_id=s.id AND so.user_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.site_members sm
      WHERE sm.site_id=s.id AND sm.user_id=auth.uid() AND sm.status='active')))
);
CREATE POLICY assets_optimized_policy ON public.assets USING (
  EXISTS (SELECT 1 FROM public.sites s WHERE s.id=assets.site_id AND (
    s.user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.site_members sm
      WHERE sm.site_id=s.id AND sm.user_id=(SELECT auth.uid()))))
);
CREATE POLICY instance_ownership_select ON public.assets AS RESTRICTIVE
  FOR SELECT TO authenticated USING (
    (instance_id IS NULL OR EXISTS (SELECT 1 FROM public.remote_instances parent
      WHERE parent.id=assets.instance_id AND parent.site_id=assets.site_id))
    AND public.user_can(site_id,'select') IS TRUE
  );