-- Team management is owner + admin, not owner-only.
-- Permissive policies OR with any existing owner-only rules.

CREATE POLICY site_members_insert_owner_admin
ON public.site_members
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_site_role(site_id) IN ('owner', 'admin'));

CREATE POLICY site_members_update_owner_admin
ON public.site_members
FOR UPDATE
TO authenticated
USING (public.current_user_site_role(site_id) IN ('owner', 'admin'))
WITH CHECK (public.current_user_site_role(site_id) IN ('owner', 'admin'));

CREATE POLICY site_members_delete_owner_admin
ON public.site_members
FOR DELETE
TO authenticated
USING (public.current_user_site_role(site_id) IN ('owner', 'admin'));

COMMENT ON POLICY site_members_insert_owner_admin ON public.site_members IS
  'Site owners and admins may invite team members.';
COMMENT ON POLICY site_members_update_owner_admin ON public.site_members IS
  'Site owners and admins may update team members.';
COMMENT ON POLICY site_members_delete_owner_admin ON public.site_members IS
  'Site owners and admins may remove team members.';
