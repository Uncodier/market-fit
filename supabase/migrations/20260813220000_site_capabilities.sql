-- Site-scoped capabilities for the current user.
-- Single matrix used by the UI helper. Adjust this file when role rules change.

CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.sites s
      WHERE s.id = p_site_id
        AND s.user_id = auth.uid()
    ) THEN 'owner'
    ELSE (
      SELECT sm.role::text
      FROM public.site_members sm
      WHERE sm.site_id = p_site_id
        AND sm.user_id = auth.uid()
        AND sm.status = 'active'
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_can(p_site_id uuid, p_command text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
  cmd text;
BEGIN
  cmd := lower(coalesce(p_command, ''));
  r := public.current_user_site_role(p_site_id);

  IF r IS NULL THEN
    RETURN false;
  END IF;

  IF cmd = 'select' THEN
    RETURN true;
  END IF;

  IF r = 'owner' THEN
    RETURN cmd IN ('insert', 'update', 'delete');
  END IF;

  IF r IN ('admin', 'collaborator') THEN
    RETURN cmd IN ('insert', 'update');
  END IF;

  -- marketing (viewer) and any unknown role: read only
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_site_capabilities(p_site_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := public.current_user_site_role(p_site_id);

  RETURN jsonb_build_object(
    'role', to_jsonb(r),
    'is_owner', coalesce(r = 'owner', false),
    'select', public.user_can(p_site_id, 'select'),
    'insert', public.user_can(p_site_id, 'insert'),
    'update', public.user_can(p_site_id, 'update'),
    'delete', public.user_can(p_site_id, 'delete')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_site_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_site_capabilities(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_site_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_site_capabilities(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.current_user_site_role(uuid) IS
  'Returns owner, admin, collaborator, marketing, or null for the current auth user on a site.';
COMMENT ON FUNCTION public.user_can(uuid, text) IS
  'Whether the current user may select/insert/update/delete on a site. Owner: all; admin/collaborator: no delete; marketing: select only.';
COMMENT ON FUNCTION public.get_my_site_capabilities(uuid) IS
  'JSON capabilities for the current user on a site. Source of truth for the permission helper UI.';
