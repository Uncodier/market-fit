-- Align site role + write matrix with how ownership actually works.
-- current_user_site_role previously ignored site_ownership and treated
-- those users as their (often stale) site_members role, so owners lost delete.
-- Admins can delete operational data; marketing stays read-only.

CREATE OR REPLACE FUNCTION public.current_user_site_role(p_site_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r text;
BEGIN
  SELECT 'owner' INTO r
  FROM public.sites s
  WHERE s.id = p_site_id
    AND s.user_id = auth.uid();

  IF FOUND THEN
    RETURN r;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.site_ownership so
    WHERE so.site_id = p_site_id
      AND so.user_id = auth.uid()
  ) THEN
    RETURN 'owner';
  END IF;

  SELECT sm.role::text INTO r
  FROM public.site_members sm
  WHERE sm.site_id = p_site_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'active'
  LIMIT 1;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can(p_site_id uuid, p_command text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

  IF r IN ('owner', 'admin') THEN
    RETURN cmd IN ('insert', 'update', 'delete');
  END IF;

  IF r = 'collaborator' THEN
    RETURN cmd IN ('insert', 'update');
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_site_capabilities(p_site_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r text;
  can_select boolean;
  can_insert boolean;
  can_update boolean;
  can_delete boolean;
BEGIN
  r := public.current_user_site_role(p_site_id);
  can_select := public.user_can(p_site_id, 'select');
  can_insert := public.user_can(p_site_id, 'insert');
  can_update := public.user_can(p_site_id, 'update');
  can_delete := public.user_can(p_site_id, 'delete');

  RETURN jsonb_build_object(
    'role', to_jsonb(r),
    'is_owner', coalesce(r = 'owner', false),
    'select', can_select,
    'insert', can_insert,
    'update', can_update,
    'delete', can_delete,
    'can_select', can_select,
    'can_insert', can_insert,
    'can_update', can_update,
    'can_delete', can_delete
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_site_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_site_capabilities(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_site_role(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_site_capabilities(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "remote_instances_access_policy" ON public.remote_instances;
CREATE POLICY "remote_instances_access_policy" ON public.remote_instances
FOR ALL
USING (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = remote_instances.site_id
    AND (
      s.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id
          AND sm.user_id = auth.uid()
          AND sm.status = 'active'
      )
    )
  )
)
WITH CHECK (
  current_setting('role'::text, true) = 'service_role'::text
  OR (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = remote_instances.site_id
    AND (
      s.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.site_ownership so
        WHERE so.site_id = s.id AND so.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id
          AND sm.user_id = auth.uid()
          AND sm.status = 'active'
      )
    )
  )
);

NOTIFY pgrst, 'reload schema';
