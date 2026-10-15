-- Rappi app registration mutates shared settings. Serialize the entire event
-- sequence across tenants in addition to the irreversible per-event receipts.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.marketplace_webhook_registration_apps (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_client_id_hash text NOT NULL CHECK (app_client_id_hash ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider IN ('uber_eats','rappi')),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  country text CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ready','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (app_client_id_hash,provider,environment,country)
);
ALTER TABLE public.marketplace_webhook_registration_apps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_webhook_registration_apps FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.marketplace_webhook_registration_apps TO service_role;
CREATE FUNCTION public.claim_marketplace_webhook_registration(p_app_hash text,p_provider text,p_environment text,
  p_country text,p_actor_user_id uuid,p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE lease public.marketplace_webhook_registration_apps; acquired boolean := true;
BEGIN
  PERFORM public.marketplace_assert_actor(p_site_id,p_actor_user_id,true);
  INSERT INTO public.marketplace_webhook_registration_apps(app_client_id_hash,provider,environment,country)
  VALUES(p_app_hash,p_provider,p_environment,p_country) ON CONFLICT DO NOTHING RETURNING * INTO lease;
  IF NOT FOUND THEN
    SELECT * INTO lease FROM public.marketplace_webhook_registration_apps WHERE app_client_id_hash=p_app_hash
      AND provider=p_provider AND environment=p_environment AND country IS NOT DISTINCT FROM p_country FOR UPDATE;
    IF lease.status='ready' THEN
      UPDATE public.marketplace_webhook_registration_apps SET status='running',claim_id=gen_random_uuid(),updated_at=now()
        WHERE claim_id=lease.claim_id RETURNING * INTO lease;
    ELSE acquired := false;
    END IF;
  END IF;
  RETURN jsonb_build_object('claim_id',lease.claim_id,'acquired',acquired,'status',lease.status);
END;
$$;
CREATE FUNCTION public.finish_marketplace_webhook_registration_app(p_claim_id uuid,p_result text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE lease public.marketplace_webhook_registration_apps;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Webhook backend required' USING ERRCODE='42501'; END IF;
  IF p_result IS NULL OR p_result NOT IN ('ready','unknown') THEN RAISE EXCEPTION 'Invalid webhook app result'; END IF;
  SELECT * INTO lease FROM public.marketplace_webhook_registration_apps WHERE claim_id=p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhook app claim unavailable'; END IF;
  IF lease.status<>'running' THEN RETURN; END IF;
  UPDATE public.marketplace_webhook_registration_apps SET status=p_result,updated_at=now() WHERE claim_id=p_claim_id;
END;
$$;
CREATE FUNCTION public.validate_marketplace_webhook_app_lease() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Webhook app lease is backend-owned' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['claim_id','status','updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['claim_id','status','updated_at']) OR (OLD.status='unknown' AND NEW.status<>'unknown')
    OR (NEW.claim_id IS DISTINCT FROM OLD.claim_id AND NOT (OLD.status='ready' AND NEW.status='running'))) THEN
    RAISE EXCEPTION 'Webhook app identity or lifecycle is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER marketplace_webhook_app_binding BEFORE INSERT OR UPDATE ON public.marketplace_webhook_registration_apps
  FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_webhook_app_lease();
REVOKE ALL ON FUNCTION public.validate_marketplace_webhook_app_lease(),
  public.claim_marketplace_webhook_registration(text,text,text,text,uuid,uuid),
  public.finish_marketplace_webhook_registration_app(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_webhook_registration(text,text,text,text,uuid,uuid),
  public.finish_marketplace_webhook_registration_app(uuid,text) TO service_role;
COMMIT;