BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.replace_site_member_location_restrictions_checked(
  p_site_id uuid,p_member_id uuid,p_location_ids uuid[],p_expected_location_ids uuid[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE expected_ids uuid[]; saved_ids uuid[];
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Location restriction writes require READ COMMITTED' USING ERRCODE='40001';
  END IF;
  IF auth.uid() IS NULL OR coalesce(public.current_user_site_role(p_site_id),'') NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Team manager access required' USING ERRCODE='42501';
  END IF;
  IF p_site_id IS NULL OR p_member_id IS NULL OR p_expected_location_ids IS NULL
    OR (cardinality(p_expected_location_ids)>0 AND array_ndims(p_expected_location_ids)<>1)
    OR EXISTS(SELECT 1 FROM unnest(p_expected_location_ids) location_id WHERE location_id IS NULL) THEN
    RAISE EXCEPTION 'The previously saved location UUID array is required' USING ERRCODE='22023';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  IF coalesce(public.current_user_site_role(p_site_id),'') NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Team manager access required' USING ERRCODE='42501';
  END IF;
  -- The legacy writer takes this same transaction lock. Compare and replace are
  -- one operation, including across simultaneous saves from separate managers.
  SELECT coalesce(array_agg(DISTINCT location_id ORDER BY location_id),'{}'::uuid[])
    INTO expected_ids FROM unnest(p_expected_location_ids) location_id;
  SELECT coalesce(array_agg(location_id ORDER BY location_id),'{}'::uuid[])
    INTO saved_ids FROM public.site_member_location_restrictions
    WHERE site_id=p_site_id AND site_member_id=p_member_id;
  IF expected_ids IS DISTINCT FROM saved_ids THEN
    -- Not 40001/55P03: replaying a stale full replacement must never auto-retry.
    RAISE EXCEPTION 'Location restrictions changed; reload before saving' USING ERRCODE='55000';
  END IF;
  RETURN public.replace_site_member_location_restrictions(p_site_id,p_member_id,p_location_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_site_member_location_restrictions_checked(uuid,uuid,uuid[],uuid[])
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.replace_site_member_location_restrictions_checked(uuid,uuid,uuid[],uuid[])
  TO authenticated;
-- The new SECURITY DEFINER wrapper retains the owner's execution rights. There
-- is no authenticated direct route around optimistic concurrency anymore.
REVOKE ALL ON FUNCTION public.replace_site_member_location_restrictions(uuid,uuid,uuid[])
  FROM PUBLIC,anon,authenticated,service_role;
COMMIT;