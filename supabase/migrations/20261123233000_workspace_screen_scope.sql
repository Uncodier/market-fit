BEGIN;
SET LOCAL lock_timeout = '5s';

-- One actor-bound screen projection. No privileged reads, roles for other users,
-- customer data, settings or cached grants. All downstream data reads retain RLS.
CREATE FUNCTION public.read_workspace_screen_scope(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  effective_role text;
  screens text[] := '{}';
  primary_owner boolean;
BEGIN
  IF actor IS NULL OR auth.jwt()->>'is_anonymous' = 'true' THEN RETURN NULL; END IF;
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner','admin','collaborator','marketing') THEN RETURN NULL; END IF;

  SELECT s.user_id = actor INTO primary_owner FROM public.sites s
    WHERE s.id = p_site_id AND s.archived_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF primary_owner IS DISTINCT FROM true THEN
    -- Match the selector's active, non-suspended membership in addition to the
    -- effective license/ownership/archival checks in current_user_site_role.
    SELECT m.blocked_screens INTO STRICT screens FROM public.site_members m
      WHERE m.site_id = p_site_id AND m.user_id = actor AND m.status = 'active' AND m.license_suspended IS FALSE;
    IF screens IS NULL THEN RETURN NULL; END IF;
  END IF;
  RETURN jsonb_build_object('actor_id',actor, 'site_id',p_site_id, 'role',effective_role,
    'blocked_screens',screens, 'location_restricted',public.current_user_has_location_restrictions());
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public.read_workspace_screen_scope(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_workspace_screen_scope(uuid) TO authenticated;
COMMIT;