BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.read_site_location_restrictions(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE effective_role text; location_rows jsonb; member_rows jsonb; enabled boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Authentication required';
  END IF;
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Team manager access required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'name',l.name,'is_active',l.is_active
  ) ORDER BY l.name,l.id),'[]'::jsonb) INTO location_rows
    FROM public.locations l WHERE l.site_id=p_site_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',sm.id,'role',sm.role,
    'is_location_exempt',sm.role IN ('owner','admin') OR EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id=p_site_id AND s.user_id=sm.user_id
    ) OR EXISTS (
      SELECT 1 FROM public.site_ownership so WHERE so.site_id=p_site_id AND so.user_id=sm.user_id
    ),
    'restricted_location_ids',coalesce((
      SELECT jsonb_agg(r.location_id ORDER BY r.location_id)
      FROM public.site_member_location_restrictions r
      WHERE r.site_id=p_site_id AND r.site_member_id=sm.id
    ),'[]'::jsonb)
  ) ORDER BY sm.id),'[]'::jsonb) INTO member_rows
    FROM public.site_members sm WHERE sm.site_id=p_site_id;
  SELECT editing_enabled INTO enabled FROM public.location_access_rollout WHERE singleton;
  RETURN jsonb_build_object('site_id',p_site_id,'locations',location_rows,'members',member_rows,
    'editing_enabled',coalesce(enabled,false));
END;
$$;
REVOKE ALL ON FUNCTION public.read_site_location_restrictions(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_site_location_restrictions(uuid) TO authenticated;

-- Fail closed if any predecessor has not compiled. Application deployment must
-- pair this database rollout with privileged HTTP/cache/POS boundary enforcement.
DO $$
BEGIN
  IF to_regprocedure('public.current_user_has_location_restrictions()') IS NULL
    OR to_regprocedure('public.location_acl_assert_unscoped_rpc()') IS NULL
    OR to_regprocedure('public.transfer_location_inventory(uuid,uuid,uuid,uuid,numeric)') IS NULL
    OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='conversations' AND policyname='location_acl_private_anon' AND permissive='RESTRICTIVE')
    OR EXISTS (
      SELECT 1 FROM location_acl_private.roots r WHERE NOT EXISTS (
        SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
          AND p.tablename=r.table_name AND p.policyname='location_acl_enforcement'
          AND p.permissive='RESTRICTIVE'
      )
    ) THEN
    RAISE EXCEPTION 'Location enforcement is incomplete' USING ERRCODE='55000';
  END IF;
END;
$$;
UPDATE public.location_access_rollout SET editing_enabled=true WHERE singleton;
COMMIT;