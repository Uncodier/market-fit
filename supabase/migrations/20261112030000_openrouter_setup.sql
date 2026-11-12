BEGIN;

CREATE TABLE public.openrouter_setup_runs (
  operation_id uuid PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id),
  connection_id uuid NOT NULL REFERENCES public.openrouter_customer_connections(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  revision integer NOT NULL,
  credential_version integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('recommend','verify')),
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  max_cost numeric NOT NULL CHECK (max_cost > 0 AND max_cost <= 1),
  state text NOT NULL DEFAULT 'dispatched' CHECK (state IN ('dispatched','completed','uncertain','failed')),
  evidence jsonb,
  payer text NOT NULL DEFAULT 'customer' CHECK (payer = 'customer'),
  platform_charge numeric NOT NULL DEFAULT 0 CHECK (platform_charge = 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE public.openrouter_setup_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openrouter_setup_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.openrouter_setup_runs TO service_role;
CREATE INDEX openrouter_setup_runs_site_created ON public.openrouter_setup_runs(site_id, created_at DESC);

CREATE FUNCTION public.openrouter_setup_claim(p_site_id uuid, p_actor_id uuid, p_operation_id uuid,
  p_expected_revision integer, p_kind text, p_fingerprint text, p_max_cost numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE c public.openrouter_customer_connections;
BEGIN
  PERFORM public.openrouter_customer_assert_manager(p_site_id, p_actor_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('openrouter:' || p_site_id::text, 0));
  SELECT * INTO c FROM public.openrouter_customer_connections WHERE site_id = p_site_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'connected' OR c.revision IS DISTINCT FROM p_expected_revision
    THEN RAISE EXCEPTION 'Connection revision conflict' USING ERRCODE = '40001'; END IF;
  -- A duplicate or crashed dispatch never earns another provider attempt.
  IF EXISTS (SELECT 1 FROM public.openrouter_setup_runs WHERE operation_id = p_operation_id) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.openrouter_setup_runs WHERE site_id = p_site_id
    AND created_at > now() - interval '1 minute') THEN RETURN false; END IF;
  -- Repeated requests across new IDs cannot exceed a small daily setup budget.
  IF (SELECT coalesce(sum(max_cost),0) FROM public.openrouter_setup_runs WHERE site_id = p_site_id
    AND created_at > now() - interval '1 day') + p_max_cost > 5 THEN RETURN false; END IF;
  INSERT INTO public.openrouter_setup_runs(operation_id,site_id,connection_id,actor_id,revision,credential_version,kind,fingerprint,max_cost)
    VALUES(p_operation_id,p_site_id,c.id,p_actor_id,c.revision,c.credential_version,p_kind,p_fingerprint,p_max_cost);
  RETURN true;
END;
$$;

CREATE FUNCTION public.openrouter_setup_finish(p_site_id uuid,p_operation_id uuid,p_state text,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.openrouter_setup_runs;
BEGIN
  IF p_state NOT IN ('completed','uncertain','failed') OR p_state IS NULL
    OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR octet_length(p_evidence::text) > 24000
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_evidence) k WHERE k NOT IN
      ('generationId','gatewayCost','modelId','fingerprint','recommendations','platformCharge','artifactId','adapterVersion','actualModel','providerTag'))
    OR (p_evidence->>'platformCharge')::numeric IS DISTINCT FROM 0
    THEN RAISE EXCEPTION 'Invalid setup evidence' USING ERRCODE = '22023'; END IF;
  SELECT * INTO r FROM public.openrouter_setup_runs WHERE operation_id = p_operation_id AND site_id = p_site_id FOR UPDATE;
  IF r.operation_id IS NULL THEN RAISE EXCEPTION 'Setup not found' USING ERRCODE = '42501'; END IF;
  IF r.state <> 'dispatched' THEN
    IF r.state = p_state AND r.evidence = p_evidence THEN RETURN; END IF;
    RAISE EXCEPTION 'Setup outcome conflict' USING ERRCODE = '40001';
  END IF;
  IF p_state = 'completed' AND (jsonb_typeof(p_evidence->'gatewayCost') IS DISTINCT FROM 'number'
    OR (p_evidence->>'gatewayCost')::numeric < 0 OR (p_evidence->>'gatewayCost')::numeric > r.max_cost)
    THEN RAISE EXCEPTION 'Setup cost not reconciled' USING ERRCODE = '22023'; END IF;
  UPDATE public.openrouter_setup_runs SET state=p_state,evidence=p_evidence,finished_at=now() WHERE operation_id=p_operation_id;
END;
$$;
REVOKE ALL ON FUNCTION public.openrouter_setup_claim(uuid,uuid,uuid,integer,text,text,numeric),
  public.openrouter_setup_finish(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_setup_claim(uuid,uuid,uuid,integer,text,text,numeric),
  public.openrouter_setup_finish(uuid,uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.openrouter_validate_image_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE proof jsonb; r public.openrouter_setup_runs;
BEGIN
  proof := NEW.capabilities->'image'->'verification';
  IF NEW.capabilities->'image'->>'status' <> 'available' THEN RETURN NEW; END IF;
  IF proof IS NULL OR proof->>'modelId' IS DISTINCT FROM NEW.capabilities->'image'->>'modelId'
    OR (proof->>'credentialVersion')::integer IS DISTINCT FROM NEW.credential_version
    OR proof->>'adapterVersion' IS DISTINCT FROM 'openrouter-images-png-v1'
    OR (proof->>'expiresAt')::timestamptz <= now() OR proof->>'expiresAt' IS NULL
    OR proof->>'providerTag' IS NULL THEN RAISE EXCEPTION 'Image verification required' USING ERRCODE='22023'; END IF;
  SELECT * INTO r FROM public.openrouter_setup_runs WHERE operation_id=(proof->>'operationId')::uuid;
  IF r.operation_id IS NULL OR r.site_id<>NEW.site_id OR r.connection_id<>NEW.id
    OR r.credential_version<>NEW.credential_version OR r.kind<>'verify' OR r.state<>'completed'
    OR r.evidence->>'artifactId' IS DISTINCT FROM proof->>'artifactId'
    OR r.evidence->>'adapterVersion' IS DISTINCT FROM proof->>'adapterVersion'
    OR r.evidence->>'modelId' IS DISTINCT FROM proof->>'modelId'
    OR r.evidence->>'providerTag' IS DISTINCT FROM proof->>'providerTag'
    OR (proof->>'expiresAt')::timestamptz > r.finished_at + interval '24 hours'
    THEN RAISE EXCEPTION 'Image proof does not match completed setup' USING ERRCODE='22023'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.openrouter_validate_image_proof() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER openrouter_validate_image_proof BEFORE INSERT OR UPDATE OF capabilities,credential_version
  ON public.openrouter_customer_connections FOR EACH ROW EXECUTE FUNCTION public.openrouter_validate_image_proof();
COMMIT;