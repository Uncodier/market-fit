BEGIN;
SET LOCAL lock_timeout = '5s';

-- Foundation only: operational tables/policies and privileged module boundaries
-- are deliberately unchanged. A future reviewed migration must enable editing
-- only after cross-module enforcement and cache invalidation are complete.
CREATE TABLE public.location_access_rollout (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  editing_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.location_access_rollout(singleton) VALUES (true);
ALTER TABLE public.location_access_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.location_access_rollout FROM PUBLIC, anon, authenticated, service_role;

-- Fail on incompatible pre-existing objects rather than hiding schema drift.
CREATE UNIQUE INDEX site_members_location_acl_site_id_id ON public.site_members(site_id, id);
CREATE UNIQUE INDEX locations_location_acl_site_id_id ON public.locations(site_id, id);
CREATE TABLE public.site_member_location_restrictions (
  site_id uuid NOT NULL,
  site_member_id uuid NOT NULL,
  location_id uuid NOT NULL,
  PRIMARY KEY (site_id, site_member_id, location_id),
  CONSTRAINT location_restrictions_member_site_fkey FOREIGN KEY (site_id, site_member_id)
    REFERENCES public.site_members(site_id, id) ON DELETE CASCADE,
  CONSTRAINT location_restrictions_location_site_fkey FOREIGN KEY (site_id, location_id)
    REFERENCES public.locations(site_id, id) ON DELETE RESTRICT
);
CREATE INDEX location_restrictions_location_idx
  ON public.site_member_location_restrictions(site_id, location_id);

-- Keep historical UUIDs even after membership/location deletion. No customer
-- payloads and no FK that would erase an audit event when a member is removed.
CREATE TABLE public.site_member_location_restriction_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id uuid NOT NULL,
  site_member_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  old_location_ids uuid[] NOT NULL,
  new_location_ids uuid[] NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (site_id, site_member_id, revision)
);
ALTER TABLE public.site_member_location_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_member_location_restriction_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_member_location_restrictions,
  public.site_member_location_restriction_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.site_member_location_restriction_audit_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.site_member_location_restrictions,
  public.site_member_location_restriction_audit TO authenticated;

CREATE POLICY location_restrictions_read ON public.site_member_location_restrictions
  FOR SELECT TO authenticated USING (
    auth.uid() IS NOT NULL AND (
      public.current_user_site_role(site_id) IN ('owner', 'admin') OR (
        public.current_user_site_role(site_id) IN ('collaborator', 'marketing') AND EXISTS (
          SELECT 1 FROM public.site_members sm WHERE sm.id = site_member_id
            AND sm.site_id = site_member_location_restrictions.site_id
            AND sm.user_id = auth.uid() AND sm.status = 'active'
        )
      )
    )
  );
CREATE POLICY location_restriction_audit_manager_read ON public.site_member_location_restriction_audit
  FOR SELECT TO authenticated USING (
    auth.uid() IS NOT NULL AND public.current_user_site_role(site_id) IN ('owner', 'admin')
  );

CREATE FUNCTION public.current_user_location_access(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  effective_role text; member_id uuid; member_count integer;
  restrictions uuid[]; current_revision integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner', 'admin', 'collaborator', 'marketing') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Site access denied';
  END IF;
  SELECT count(*), (array_agg(sm.id))[1] INTO member_count, member_id
    FROM public.site_members sm WHERE sm.site_id = p_site_id
      AND sm.user_id = auth.uid() AND sm.status = 'active';
  -- A primary owner need not have a membership row. All other valid roles do.
  IF member_count > 1 OR (member_count = 0 AND effective_role <> 'owner') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Site access denied';
  END IF;
  SELECT coalesce(array_agg(r.location_id ORDER BY r.location_id), '{}'::uuid[]) INTO restrictions
    FROM public.site_member_location_restrictions r
    WHERE r.site_id = p_site_id AND r.site_member_id = member_id;
  SELECT coalesce(max(a.revision), 0) INTO current_revision
    FROM public.site_member_location_restriction_audit a
    WHERE a.site_id = p_site_id AND a.site_member_id = member_id;
  RETURN jsonb_build_object('site_id', p_site_id, 'role', effective_role,
    'restricted_location_ids', restrictions, 'revision', current_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.current_user_location_access(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_location_access(uuid) TO authenticated;

-- One authenticated statement/snapshot: never stitch privileged metadata to an
-- RLS-filtered or PostgREST-row-limited subset and misreport missing exclusions.
CREATE FUNCTION public.read_site_location_restrictions(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE effective_role text; location_rows jsonb; member_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Team manager access required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'name', l.name, 'is_active', l.is_active
  ) ORDER BY l.name, l.id), '[]'::jsonb) INTO location_rows
    FROM public.locations l WHERE l.site_id = p_site_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', sm.id, 'role', sm.role,
    'is_location_exempt', sm.role IN ('owner', 'admin') OR EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.user_id = sm.user_id
    ) OR EXISTS (
      SELECT 1 FROM public.site_ownership so WHERE so.site_id = p_site_id AND so.user_id = sm.user_id
    ),
    'restricted_location_ids', coalesce((
      SELECT jsonb_agg(r.location_id ORDER BY r.location_id)
        FROM public.site_member_location_restrictions r
        WHERE r.site_id = p_site_id AND r.site_member_id = sm.id
    ), '[]'::jsonb)
  ) ORDER BY sm.id), '[]'::jsonb) INTO member_rows
    FROM public.site_members sm WHERE sm.site_id = p_site_id;
  RETURN jsonb_build_object('site_id', p_site_id, 'locations', location_rows, 'members', member_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.read_site_location_restrictions(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_site_location_restrictions(uuid) TO authenticated;

-- This helper is an additional location predicate, NOT action authorization.
-- Lookup exceptions propagate (deny); they are never converted to empty lists.
CREATE FUNCTION public.user_can_access_location(p_site_id uuid, p_location_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE effective_role text; member_id uuid; member_count integer;
BEGIN
  IF auth.uid() IS NULL OR p_site_id IS NULL THEN RETURN false; END IF;
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner', 'admin', 'collaborator', 'marketing') THEN
    RETURN false;
  END IF;
  -- Even an exempt manager cannot authorize unknown or cross-site locations.
  IF p_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations l WHERE l.id = p_location_id AND l.site_id = p_site_id
  ) THEN RETURN false; END IF;
  SELECT count(*), (array_agg(sm.id))[1] INTO member_count, member_id
    FROM public.site_members sm WHERE sm.site_id = p_site_id
      AND sm.user_id = auth.uid() AND sm.status = 'active';
  IF member_count > 1 OR (member_count = 0 AND effective_role <> 'owner') THEN RETURN false; END IF;
  IF effective_role IN ('owner', 'admin') THEN RETURN true; END IF;
  IF p_location_id IS NULL THEN
    RETURN NOT EXISTS (SELECT 1 FROM public.site_member_location_restrictions r
      WHERE r.site_id = p_site_id AND r.site_member_id = member_id);
  END IF;
  RETURN NOT EXISTS (SELECT 1 FROM public.site_member_location_restrictions r
    WHERE r.site_id = p_site_id AND r.site_member_id = member_id AND r.location_id = p_location_id);
END;
$$;
REVOKE ALL ON FUNCTION public.user_can_access_location(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_location(uuid, uuid) TO authenticated;

CREATE FUNCTION public.replace_site_member_location_restrictions(
  p_site_id uuid, p_member_id uuid, p_location_ids uuid[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid(); effective_role text; target public.site_members%ROWTYPE;
  rollout_enabled boolean; old_ids uuid[]; new_ids uuid[]; current_revision integer;
BEGIN
  -- A serializable snapshot can still serialize before a concurrent revocation
  -- after waiting for its lock. This RPC needs fresh post-lock authorization.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Location restriction writes require READ COMMITTED';
  END IF;
  IF actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Team manager access required';
  END IF;
  SELECT editing_enabled INTO rollout_enabled FROM public.location_access_rollout
    WHERE singleton FOR SHARE;
  IF rollout_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Location restriction editing is not enabled';
  END IF;
  IF p_site_id IS NULL OR p_member_id IS NULL OR p_location_ids IS NULL
    OR (cardinality(p_location_ids) > 0 AND array_ndims(p_location_ids) <> 1)
    OR EXISTS (SELECT 1 FROM unnest(p_location_ids) location_id WHERE location_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A member and a non-null location UUID array are required';
  END IF;
  -- Serialize with license/membership transitions; a stale isolation snapshot is
  -- not allowed. Existing membership triggers also use this site lock.
  PERFORM public.lock_site_license(p_site_id);
  effective_role := public.current_user_site_role(p_site_id);
  IF effective_role IS NULL OR effective_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Team manager access required';
  END IF;
  -- Ordinary membership UPDATE locks its row before the license trigger locks
  -- the site. Never wait for that row while holding the site lock: return 55P03
  -- so the whole request can be retried rather than deadlocking either writer.
  SELECT * INTO target FROM public.site_members
    WHERE id = p_member_id AND site_id = p_site_id FOR UPDATE NOWAIT;
  IF NOT FOUND OR target.status IS NULL OR target.status NOT IN ('active', 'pending')
    OR target.role IS NULL OR target.role NOT IN ('owner', 'admin', 'collaborator', 'marketing')
    OR (target.status = 'active' AND target.user_id IS NULL)
    OR (target.status = 'pending' AND nullif(btrim(target.email), '') IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'An active member or valid pending invitation in this site is required';
  END IF;
  SELECT coalesce(array_agg(DISTINCT location_id ORDER BY location_id), '{}'::uuid[]) INTO new_ids
    FROM unnest(p_location_ids) location_id;
  IF cardinality(new_ids) > 0 AND (
    target.role IN ('owner', 'admin') OR EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.user_id = target.user_id
    ) OR EXISTS (SELECT 1 FROM public.site_ownership so
      WHERE so.site_id = p_site_id AND so.user_id = target.user_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Owners and admins are exempt from location restrictions';
  END IF;
  -- Lock every resolved location to stabilize tenant identity against moves or
  -- deletion, then compare the full count. No partial filtering/silent clearing.
  PERFORM 1 FROM public.locations l WHERE l.site_id = p_site_id AND l.id = ANY(new_ids)
    ORDER BY l.id FOR KEY SHARE;
  IF (SELECT count(*) FROM public.locations l WHERE l.site_id = p_site_id AND l.id = ANY(new_ids))
    <> cardinality(new_ids) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Every location must belong to this site';
  END IF;
  SELECT coalesce(array_agg(r.location_id ORDER BY r.location_id), '{}'::uuid[]) INTO old_ids
    FROM public.site_member_location_restrictions r
    WHERE r.site_id = p_site_id AND r.site_member_id = p_member_id;
  SELECT coalesce(max(a.revision), 0) INTO current_revision
    FROM public.site_member_location_restriction_audit a
    WHERE a.site_id = p_site_id AND a.site_member_id = p_member_id;
  IF old_ids IS DISTINCT FROM new_ids THEN
    DELETE FROM public.site_member_location_restrictions
      WHERE site_id = p_site_id AND site_member_id = p_member_id;
    INSERT INTO public.site_member_location_restrictions(site_id, site_member_id, location_id)
      SELECT p_site_id, p_member_id, location_id FROM unnest(new_ids) location_id;
    current_revision := current_revision + 1;
    INSERT INTO public.site_member_location_restriction_audit(
      site_id, site_member_id, actor_user_id, old_location_ids, new_location_ids, revision
    ) VALUES (p_site_id, p_member_id, actor, old_ids, new_ids, current_revision);
  END IF;
  RETURN jsonb_build_object('site_id', p_site_id, 'site_member_id', p_member_id,
    'restricted_location_ids', new_ids, 'revision', current_revision);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_site_member_location_restrictions(uuid, uuid, uuid[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_site_member_location_restrictions(uuid, uuid, uuid[]) TO authenticated;

COMMIT;