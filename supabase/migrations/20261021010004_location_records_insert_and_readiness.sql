BEGIN;
SET LOCAL lock_timeout = '5s';

-- records uses column-level INSERT/UPDATE grants from its access-hardening
-- migration. Only creation needs the new location column; do not grant UPDATE.
GRANT INSERT(location_id) ON public.records TO authenticated;

-- A false per-site result is used to authorize unscoped caches/projections.
-- Missing/revoked membership is therefore unavailable, not unrestricted. This
-- check must not revive a stale role read made before membership was revoked.
CREATE OR REPLACE FUNCTION public.current_user_has_site_location_restrictions(p_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR public.current_user_site_role(p_site_id) IS NULL THEN true
    WHEN public.current_user_site_role(p_site_id) IN ('owner','admin') THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.site_members m
      JOIN public.site_member_location_restrictions r
        ON r.site_id=m.site_id AND r.site_member_id=m.id
      WHERE m.site_id=p_site_id AND m.user_id=auth.uid()
    )
  END;
$$;
COMMENT ON FUNCTION public.current_user_has_site_location_restrictions(uuid) IS
  'Deny-unscoped predicate: revoked or missing membership is treated as restricted.';

DO $$
BEGIN
  IF to_regprocedure('public.replace_site_member_location_restrictions_checked(uuid,uuid,uuid[],uuid[])') IS NULL
    OR has_function_privilege('authenticated','public.replace_site_member_location_restrictions(uuid,uuid,uuid[])','EXECUTE')
    OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.site_ownership'::regclass
      AND polname='location_acl_ownership_insert' AND NOT polpermissive)
    OR EXISTS(SELECT 1 FROM location_acl_private.roots r WHERE NOT EXISTS(
      SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.'||r.table_name)
        AND t.tgname='location_acl_20_immutable' AND t.tgenabled='O'))
    OR EXISTS(SELECT 1 FROM location_acl_private.links l WHERE NOT EXISTS(
      SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.'||l.child_table)
        AND t.tgname='location_acl_inherit' AND t.tgenabled='O')) THEN
    RAISE EXCEPTION 'Location ACL review protections are incomplete';
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;