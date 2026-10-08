BEGIN;

ALTER TABLE public.site_members ADD COLUMN manually_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.site_members ADD CONSTRAINT site_members_manual_disable_suspends
  CHECK (NOT manually_disabled OR license_suspended);

CREATE OR REPLACE FUNCTION public.get_site_member_license(p_site_id uuid, p_member_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  owner_id uuid; plan_name text; seat_limit integer; used integer; demand integer;
BEGIN
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id AND archived_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.site_members WHERE id = p_member_id AND site_id = p_site_id
  ) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Member does not belong to site'; END IF;
  SELECT plan::text INTO plan_name FROM public.billing WHERE site_id = p_site_id;
  plan_name := CASE WHEN plan_name IN ('engine','foundry','enterprise') THEN plan_name ELSE 'commission' END;
  seat_limit := CASE plan_name WHEN 'engine' THEN 5 WHEN 'foundry' THEN 10 WHEN 'enterprise' THEN NULL ELSE 1 END;
  SELECT 1 + count(*) FILTER (WHERE NOT license_suspended AND id IS DISTINCT FROM p_member_id),
    1 + count(*) INTO used, demand
  FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id
    AND status IN ('active','pending') AND NOT manually_disabled;
  RETURN jsonb_build_object('plan',plan_name,'current',used,'total',demand,'limit',seat_limit,
    'requiredPlan',CASE WHEN used + 1 <= 1 THEN 'commission' WHEN used + 1 <= 5 THEN 'engine'
      WHEN used + 1 <= 10 THEN 'foundry' ELSE 'enterprise' END,'siteId',p_site_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_member_license(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_member_license(uuid,uuid) TO service_role;

-- Keep the invoker boundary: client claims cannot impersonate the service role.
CREATE OR REPLACE FUNCTION public.protect_member_license()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND TG_OP = 'INSERT' THEN NEW.created_at := clock_timestamp(); END IF;
  IF TG_OP = 'UPDATE' AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Member addition time is immutable';
  END IF;
  IF current_user IN ('anon','authenticated') AND TG_OP = 'UPDATE' AND OLD.user_id IS NULL
    AND NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Invitation identity must match authenticated user';
  END IF;
  IF current_user IN ('anon','authenticated') AND (
    (TG_OP = 'INSERT' AND NEW.license_suspended) OR
    (TG_OP = 'UPDATE' AND NEW.license_suspended IS DISTINCT FROM OLD.license_suspended)
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'License suspension is server managed'; END IF;
  IF current_user IN ('anon','authenticated') AND (
    (TG_OP = 'INSERT' AND NEW.manually_disabled) OR
    (TG_OP = 'UPDATE' AND NEW.manually_disabled IS DISTINCT FROM OLD.manually_disabled)
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Member enabled state is server managed'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_member_license() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_member_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE payload jsonb; primary_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.site_id IS DISTINCT FROM OLD.site_id
    OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NOT
      (OLD.user_id IS NULL AND OLD.status = 'pending' AND NEW.status = 'active' AND NEW.user_id IS NOT NULL))) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Member identity and site are immutable';
  END IF;
  PERFORM public.lock_site_license(CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT user_id INTO primary_owner FROM public.sites WHERE id = NEW.site_id;
  IF NEW.user_id = primary_owner THEN
    NEW.manually_disabled := false; NEW.license_suspended := false; RETURN NEW;
  END IF;
  IF NEW.manually_disabled THEN NEW.license_suspended := true; END IF;
  IF NEW.status IN ('active','pending') AND NOT NEW.license_suspended AND (
    TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'active' AND OLD.status IS DISTINCT FROM 'pending') OR OLD.license_suspended
  ) THEN
    payload := public.get_site_member_license(NEW.site_id,CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END);
    IF (payload->>'limit') IS NOT NULL AND (payload->>'current')::integer >= (payload->>'limit')::integer THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MEMBER_LIMIT', DETAIL = payload::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_member_license() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reconcile_site_member_license(p_site_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE payload jsonb; owner_id uuid; capacity integer;
BEGIN
  PERFORM public.lock_site_license(p_site_id);
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id;
  -- Ownership transfers clear both flags, including while the site is archived.
  UPDATE public.site_members SET manually_disabled = false,license_suspended = false
    WHERE site_id = p_site_id AND user_id = owner_id AND (manually_disabled OR license_suspended);
  payload := public.get_site_member_license(p_site_id);
  -- Other archived memberships retain their state until the site is restored.
  IF payload IS NULL THEN RETURN; END IF;
  capacity := coalesce((payload->>'limit')::integer - 1,2147483646);
  WITH ranked AS (
    SELECT id,row_number() OVER (ORDER BY created_at ASC NULLS LAST,id) AS position
    FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id
      AND status IN ('active','pending') AND NOT manually_disabled
  ) UPDATE public.site_members sm SET license_suspended = true FROM ranked r
    WHERE sm.id = r.id AND r.position > capacity AND NOT sm.license_suspended;
  WITH ranked AS (
    SELECT id,row_number() OVER (ORDER BY created_at ASC NULLS LAST,id) AS position
    FROM public.site_members WHERE site_id = p_site_id AND user_id IS DISTINCT FROM owner_id
      AND status IN ('active','pending') AND NOT manually_disabled
  ) UPDATE public.site_members sm SET license_suspended = false FROM ranked r
    WHERE sm.id = r.id AND r.position <= capacity AND sm.license_suspended;
  UPDATE public.site_members SET license_suspended = false WHERE site_id = p_site_id
    AND status NOT IN ('active','pending') AND NOT manually_disabled AND license_suspended;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_site_member_license(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The server route must authorize a site manager before using this service-only RPC.
CREATE OR REPLACE FUNCTION public.set_site_member_enabled(p_site_id uuid,p_member_id uuid,p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target public.site_members%ROWTYPE; owner_id uuid;
BEGIN
  IF p_site_id IS NULL OR p_member_id IS NULL OR p_enabled IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Member enabled inputs are required';
  END IF;
  PERFORM public.lock_site_license(p_site_id);
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Site is unavailable'; END IF;
  SELECT * INTO target FROM public.site_members WHERE id = p_member_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Member does not belong to site'; END IF;
  IF target.role = 'owner' OR target.user_id = owner_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Site owners cannot be disabled';
  END IF;
  IF target.status IS NULL OR target.status NOT IN ('active','pending') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Only active or pending members can be enabled or disabled';
  END IF;
  -- The existing guard admits reactivation only when a seat is actually free.
  -- Do not rerank on enable: a request must never succeed only to be suspended again.
  UPDATE public.site_members SET manually_disabled = NOT p_enabled,license_suspended = NOT p_enabled
    WHERE id = target.id;
  IF NOT p_enabled THEN PERFORM public.reconcile_site_member_license(p_site_id); END IF;
  SELECT * INTO target FROM public.site_members WHERE id = p_member_id AND site_id = p_site_id;
  RETURN to_jsonb(target);
END;
$$;
REVOKE ALL ON FUNCTION public.set_site_member_enabled(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_site_member_enabled(uuid,uuid,boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;