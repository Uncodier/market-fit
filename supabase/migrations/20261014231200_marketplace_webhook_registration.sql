-- Register each provider app/event only once. A lost provider response is
-- durable unknown, not permission to rotate all merchants' webhook secrets.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.marketplace_webhook_registrations (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_client_id_hash text NOT NULL CHECK (app_client_id_hash ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider IN ('uber_eats','rappi')),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  country text CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  integration_id uuid REFERENCES public.marketplace_integrations(id),
  event text NOT NULL CHECK (length(event) BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE NULLS NOT DISTINCT (app_client_id_hash,provider,environment,country,integration_id,event)
);
ALTER TABLE public.marketplace_webhook_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_webhook_registrations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.marketplace_webhook_registrations TO service_role;

CREATE FUNCTION public.claim_marketplace_webhook_registration(p_scope jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE registration public.marketplace_webhook_registrations; duplicate boolean := false;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Webhook backend required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_scope) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid webhook app scope'; END IF;
  INSERT INTO public.marketplace_webhook_registrations(app_client_id_hash,provider,environment,country,integration_id,event)
  VALUES(p_scope->>'app_client_id_hash',p_scope->>'provider',p_scope->>'environment',p_scope->>'country',
    (p_scope->>'integration_id')::uuid,p_scope->>'event') ON CONFLICT DO NOTHING RETURNING * INTO registration;
  IF NOT FOUND THEN
    duplicate := true;
    SELECT * INTO registration FROM public.marketplace_webhook_registrations
      WHERE app_client_id_hash=p_scope->>'app_client_id_hash' AND provider=p_scope->>'provider'
        AND environment=p_scope->>'environment' AND country IS NOT DISTINCT FROM p_scope->>'country'
        AND integration_id IS NOT DISTINCT FROM (p_scope->>'integration_id')::uuid AND event=p_scope->>'event' FOR UPDATE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketplace_provider_webhook_keys k WHERE k.app_client_id_hash=registration.app_client_id_hash
    AND k.provider=registration.provider AND k.environment=registration.environment
    AND k.country IS NOT DISTINCT FROM registration.country AND k.integration_id IS NOT DISTINCT FROM registration.integration_id
    AND k.event=registration.event) THEN
    duplicate := true;
    UPDATE public.marketplace_webhook_registrations SET status='ready',finished_at=coalesce(finished_at,now())
      WHERE claim_id=registration.claim_id RETURNING * INTO registration;
  END IF;
  RETURN jsonb_build_object('claim_id',registration.claim_id,'duplicate',duplicate,'status',registration.status);
END;
$$;
CREATE FUNCTION public.finish_marketplace_webhook_registration(p_claim_id uuid,p_result text,p_secret_ciphertext text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE registration public.marketplace_webhook_registrations;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Webhook backend required' USING ERRCODE='42501'; END IF;
  IF p_result IS NULL OR p_result NOT IN ('ready','unknown') THEN RAISE EXCEPTION 'Invalid webhook registration result'; END IF;
  SELECT * INTO registration FROM public.marketplace_webhook_registrations WHERE claim_id=p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhook registration unavailable'; END IF;
  IF registration.status='ready' THEN RETURN; END IF;
  IF p_result='ready' THEN
    IF p_secret_ciphertext IS NULL THEN RAISE EXCEPTION 'Encrypted webhook secret required'; END IF;
    INSERT INTO public.marketplace_provider_webhook_keys(app_client_id_hash,provider,environment,country,integration_id,event,secret_ciphertext)
    VALUES(registration.app_client_id_hash,registration.provider,registration.environment,registration.country,
      registration.integration_id,registration.event,p_secret_ciphertext) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.marketplace_webhook_registrations SET status=p_result,finished_at=now() WHERE claim_id=registration.claim_id;
END;
$$;
CREATE FUNCTION public.validate_marketplace_webhook_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Webhook registration is backend-owned' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['status','finished_at']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','finished_at']) OR (OLD.status='ready' AND NEW.status<>'ready')
    OR (OLD.status='unknown' AND NEW.status='pending')) THEN
    RAISE EXCEPTION 'Webhook registration identity or lifecycle is immutable';
  END IF;
  IF NEW.integration_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.marketplace_integrations i
    JOIN public.marketplace_merchant_connections c ON c.id=i.merchant_connection_id WHERE i.id=NEW.integration_id
      AND c.app_client_id_hash=NEW.app_client_id_hash AND i.provider=NEW.provider AND i.environment=NEW.environment
      AND (NEW.country IS NULL OR i.country=NEW.country)) THEN RAISE EXCEPTION 'Webhook registration app scope mismatch'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER marketplace_webhook_registration_binding BEFORE INSERT OR UPDATE ON public.marketplace_webhook_registrations
  FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_webhook_registration();
REVOKE ALL ON FUNCTION public.validate_marketplace_webhook_registration(),public.claim_marketplace_webhook_registration(jsonb),
  public.finish_marketplace_webhook_registration(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_webhook_registration(jsonb),
  public.finish_marketplace_webhook_registration(uuid,text,text) TO service_role;
COMMIT;