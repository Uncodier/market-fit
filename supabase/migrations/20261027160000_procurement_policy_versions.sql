BEGIN;

-- Private, append-only site configuration. No operational approval decisions
-- are stored here. The API validates the complete versioned policy schema.
-- Manager RPC callers can bypass API reference validation. Stored references
-- never confer permissions: consumers must revalidate site ownership and access
-- before executing any future procurement workflow or approval.
CREATE TABLE public.procurement_policy_versions (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  -- Deliberately no cascading user FK: removing an account must not erase audit.
  created_by uuid NOT NULL,
  PRIMARY KEY (site_id, revision),
  CONSTRAINT procurement_policy_document_shape CHECK (COALESCE(
    jsonb_typeof(document) = 'object'
    AND document -> 'version' = '1'::jsonb
    AND jsonb_typeof(document -> 'settings') = 'object'
    AND jsonb_typeof(document -> 'rules') = 'array'
    AND document - ARRAY['version', 'settings', 'rules']::text[] = '{}'::jsonb,
    false
  )),
  CONSTRAINT procurement_policy_document_size CHECK (
    octet_length(convert_to(document::text, 'UTF8')) <= 262144
  )
);

ALTER TABLE public.procurement_policy_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.procurement_policy_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.procurement_policy_versions TO authenticated;

CREATE POLICY procurement_policy_manager_read
  ON public.procurement_policy_versions FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.current_user_site_role(site_id) IN ('owner', 'admin')
    AND NOT public.current_user_has_site_location_restrictions(site_id)
  );

CREATE FUNCTION public.reject_procurement_policy_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Procurement policy history is immutable'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_procurement_policy_history_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER procurement_policy_history_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.procurement_policy_versions
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_procurement_policy_history_mutation();

CREATE FUNCTION public.save_procurement_policy(
  p_site_id uuid,
  p_expected_revision integer,
  p_document jsonb
)
RETURNS TABLE (revision integer, document jsonb, created_at timestamptz, created_by uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_revision integer;
BEGIN
  IF v_actor IS NULL OR p_site_id IS NULL
    OR NOT COALESCE(public.current_user_site_role(p_site_id) IN ('owner', 'admin'), false)
    OR public.current_user_has_site_location_restrictions(p_site_id) IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION 'Procurement policy access denied' USING ERRCODE = '42501';
  END IF;

  IF p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'Invalid expected procurement policy revision' USING ERRCODE = '22023';
  END IF;

  -- The site may not have a row yet, so a row lock cannot serialize first saves.
  -- Hash collisions only serialize unrelated sites; they cannot bypass CAS.
  PERFORM pg_advisory_xact_lock(hashtextextended('procurement_policy:' || p_site_id::text, 0));

  SELECT COALESCE(max(v.revision), 0) INTO v_revision
    FROM public.procurement_policy_versions AS v WHERE v.site_id = p_site_id;
  IF p_expected_revision <> v_revision THEN
    RAISE EXCEPTION 'Procurement policy revision conflict' USING ERRCODE = '40001';
  END IF;

  RETURN QUERY
    INSERT INTO public.procurement_policy_versions AS saved
      (site_id, revision, document, created_at, created_by)
    VALUES (p_site_id, v_revision + 1, p_document, clock_timestamp(), v_actor)
    RETURNING saved.revision, saved.document, saved.created_at, saved.created_by;
EXCEPTION WHEN unique_violation THEN
  -- A caller using a transaction snapshot older than the lock acquisition must
  -- still receive a retryable conflict, never overwrite or lose history.
  RAISE EXCEPTION 'Procurement policy revision conflict' USING ERRCODE = '40001';
END;
$$;

REVOKE ALL ON FUNCTION public.save_procurement_policy(uuid, integer, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_procurement_policy(uuid, integer, jsonb)
  TO authenticated;

COMMIT;