-- Forward-only consent ledger. All ciphertext and app keys are server-only.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.marketplace_platform_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('uber_eats','rappi')),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  country text NOT NULL CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  app_client_id_hash text NOT NULL CHECK (app_client_id_hash ~ '^[0-9a-f]{64}$'),
  encrypted_credentials text NOT NULL CHECK (length(encrypted_credentials) BETWEEN 16 AND 32768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,environment,country),
  CHECK (provider <> 'rappi' OR country NOT IN ('CA','US'))
);
-- Environment configuration is the initial source of platform app credentials.
-- This table is reserved for server-managed configuration, never a tenant copy.
CREATE TABLE public.marketplace_oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  provider text NOT NULL CHECK (provider IN ('uber_eats','rappi')),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  country text NOT NULL CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  credential_mode text NOT NULL CHECK (credential_mode IN ('custom','platform')),
  encrypted_context text CHECK (length(encrypted_context) BETWEEN 16 AND 32768),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','claimed','completed','failed')),
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
  CHECK (status NOT IN ('created','claimed') OR encrypted_context IS NOT NULL),
  CHECK (status NOT IN ('completed','failed') OR encrypted_context IS NULL),
  CHECK (provider <> 'rappi' OR country NOT IN ('CA','US'))
);
CREATE TABLE public.marketplace_merchant_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_session_id uuid NOT NULL UNIQUE REFERENCES public.marketplace_oauth_sessions(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  provider text NOT NULL CHECK (provider IN ('uber_eats','rappi')),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  country text NOT NULL CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  credential_mode text NOT NULL CHECK (credential_mode IN ('custom','platform')),
  app_client_id_hash text NOT NULL CHECK (app_client_id_hash ~ '^[0-9a-f]{64}$'),
  encrypted_authorization text CHECK (length(encrypted_authorization) BETWEEN 16 AND 32768),
  token_expires_at timestamptz,
  authorized_stores jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'authorized' CHECK (status IN ('authorized','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(authorized_stores) = 'array' AND octet_length(authorized_stores::text) <= 131072),
  CHECK (status <> 'authorized' OR encrypted_authorization IS NOT NULL),
  CHECK (status <> 'revoked' OR encrypted_authorization IS NULL),
  CHECK (provider <> 'rappi' OR country NOT IN ('CA','US'))
);
CREATE INDEX marketplace_merchant_connections_site ON public.marketplace_merchant_connections(site_id,provider,status);
CREATE TABLE public.marketplace_provider_webhook_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_client_id_hash text NOT NULL CHECK (app_client_id_hash ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider IN ('uber_eats','rappi')),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  country text CHECK (country IN ('AR','BR','CA','CL','CO','CR','EC','MX','PE','US','UY')),
  integration_id uuid REFERENCES public.marketplace_integrations(id),
  event text NOT NULL CHECK (length(event) BETWEEN 1 AND 100),
  secret_ciphertext text NOT NULL CHECK (length(secret_ciphertext) BETWEEN 16 AND 32768),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (app_client_id_hash,provider,environment,country,integration_id,event)
);
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['marketplace_platform_apps','marketplace_oauth_sessions',
    'marketplace_merchant_connections','marketplace_provider_webhook_keys'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',name);
  END LOOP;
END $$;

CREATE FUNCTION public.begin_marketplace_oauth(p_context jsonb,p_state_hash text,
  p_encrypted_context text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.marketplace_oauth_sessions;
BEGIN
  PERFORM public.marketplace_assert_actor((p_context->>'site_id')::uuid,p_actor_user_id,true);
  IF jsonb_typeof(p_context) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid OAuth context'; END IF;
  INSERT INTO public.marketplace_oauth_sessions(id,state_hash,site_id,user_id,provider,environment,country,
    credential_mode,encrypted_context,expires_at)
  VALUES(coalesce((p_context->>'id')::uuid,gen_random_uuid()),p_state_hash,(p_context->>'site_id')::uuid,
    p_actor_user_id,p_context->>'provider',p_context->>'environment',p_context->>'country',
    coalesce(p_context->>'credential_mode','platform'),p_encrypted_context,
    coalesce((p_context->>'expires_at')::timestamptz,now()+interval '10 minutes')) RETURNING * INTO session;
  RETURN to_jsonb(session);
END;
$$;
CREATE FUNCTION public.claim_marketplace_oauth(p_state_hash text,p_provider text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.marketplace_oauth_sessions;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'OAuth backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO session FROM public.marketplace_oauth_sessions WHERE state_hash = p_state_hash FOR UPDATE;
  IF NOT FOUND OR session.user_id IS DISTINCT FROM p_actor_user_id OR session.provider IS DISTINCT FROM p_provider
    OR session.status <> 'created' OR session.expires_at <= now() THEN
    RAISE EXCEPTION 'OAuth state unavailable' USING ERRCODE='42501';
  END IF;
  PERFORM public.marketplace_assert_actor(session.site_id,p_actor_user_id,true);
  UPDATE public.marketplace_oauth_sessions SET status='claimed',claimed_at=now() WHERE id=session.id RETURNING * INTO session;
  RETURN to_jsonb(session);
END;
$$;
CREATE FUNCTION public.complete_marketplace_oauth(p_session_id uuid,p_encrypted_authorization text,
  p_expires_at timestamptz,p_app_client_id_hash text,p_actor_user_id uuid,p_authorized_stores jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.marketplace_oauth_sessions; connection_id uuid;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'OAuth backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO session FROM public.marketplace_oauth_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR session.user_id IS DISTINCT FROM p_actor_user_id OR session.status <> 'claimed'
    OR session.expires_at <= now() OR (p_expires_at IS NOT NULL AND p_expires_at <= now()) THEN
    RAISE EXCEPTION 'OAuth claim unavailable' USING ERRCODE='42501';
  END IF;
  PERFORM public.marketplace_assert_actor(session.site_id,p_actor_user_id,true);
  INSERT INTO public.marketplace_merchant_connections(oauth_session_id,site_id,provider,environment,country,
    credential_mode,app_client_id_hash,encrypted_authorization,token_expires_at,actor_user_id,authorized_stores)
  VALUES(session.id,session.site_id,session.provider,session.environment,session.country,session.credential_mode,
    p_app_client_id_hash,p_encrypted_authorization,p_expires_at,p_actor_user_id,p_authorized_stores) RETURNING id INTO connection_id;
  UPDATE public.marketplace_oauth_sessions SET status='completed',encrypted_context=NULL,finished_at=now() WHERE id=session.id;
  RETURN jsonb_build_object('connection_id',connection_id);
END;
$$;
CREATE FUNCTION public.fail_marketplace_oauth(p_session_id uuid,p_actor_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE session public.marketplace_oauth_sessions;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'OAuth backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO session FROM public.marketplace_oauth_sessions WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR session.user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'OAuth state unavailable' USING ERRCODE='42501';
  END IF;
  PERFORM public.marketplace_assert_actor(session.site_id,p_actor_user_id,true);
  IF session.status IN ('created','claimed') THEN
    UPDATE public.marketplace_oauth_sessions SET status='failed',encrypted_context=NULL,finished_at=now() WHERE id=session.id;
  END IF;
END;
$$;

-- Direct server writes cannot rebind consent, resurrect a used state, or replace
-- webhook secrets while registering another event. App-level rotations are explicit.
CREATE FUNCTION public.validate_marketplace_consent() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Consent is backend-owned' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='marketplace_oauth_sessions' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['status','claimed_at','finished_at','encrypted_context']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','claimed_at','finished_at','encrypted_context'])
      OR (NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='created' AND NEW.status IN ('claimed','failed'))
        OR (OLD.status='claimed' AND NEW.status IN ('completed','failed')))) THEN
      RAISE EXCEPTION 'OAuth state identity or lifecycle is immutable';
    END IF;
  ELSIF TG_TABLE_NAME='marketplace_merchant_connections' THEN
    IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['status','encrypted_authorization','token_expires_at','authorized_stores','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','encrypted_authorization','token_expires_at','authorized_stores','updated_at'])
      OR (OLD.status='revoked' AND NEW.status<>'revoked')) THEN RAISE EXCEPTION 'Merchant connection identity is immutable'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.marketplace_oauth_sessions s WHERE s.id=NEW.oauth_session_id
      AND (s.site_id,s.user_id,s.provider,s.environment,s.country,s.credential_mode) =
        (NEW.site_id,NEW.actor_user_id,NEW.provider,NEW.environment,NEW.country,NEW.credential_mode)
      AND s.status IN ('claimed','completed')) THEN RAISE EXCEPTION 'Merchant consent binding mismatch'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.authorized_stores) store
      WHERE jsonb_typeof(store) IS DISTINCT FROM 'object' OR length(coalesce(store->>'id','')) NOT BETWEEN 1 AND 200) THEN
      RAISE EXCEPTION 'Invalid authorized store identity';
    END IF;
    IF NEW.status='revoked' AND EXISTS (SELECT 1 FROM public.marketplace_integrations i
      WHERE to_jsonb(i)->>'merchant_connection_id'=NEW.id::text AND i.enabled) THEN
      RAISE EXCEPTION 'Disable integrations before revoking consent';
    END IF;
  ELSIF TG_TABLE_NAME='marketplace_provider_webhook_keys' THEN
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Registered webhook key is immutable'; END IF;
    IF NEW.integration_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.marketplace_integrations i
      JOIN public.marketplace_merchant_connections c ON c.id=(to_jsonb(i)->>'merchant_connection_id')::uuid
      WHERE i.id=NEW.integration_id AND i.provider=NEW.provider AND i.environment=NEW.environment
        AND (NEW.country IS NULL OR i.country=NEW.country) AND c.app_client_id_hash=NEW.app_client_id_hash) THEN
      RAISE EXCEPTION 'Webhook key app scope mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER marketplace_oauth_binding BEFORE INSERT OR UPDATE ON public.marketplace_oauth_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_consent();
CREATE TRIGGER marketplace_merchant_binding BEFORE INSERT OR UPDATE ON public.marketplace_merchant_connections
  FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_consent();
CREATE TRIGGER marketplace_webhook_key_binding BEFORE INSERT OR UPDATE ON public.marketplace_provider_webhook_keys
  FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_consent();
REVOKE ALL ON FUNCTION public.validate_marketplace_consent(),
  public.begin_marketplace_oauth(jsonb,text,text,uuid),public.claim_marketplace_oauth(text,text,uuid),
  public.complete_marketplace_oauth(uuid,text,timestamptz,text,uuid,jsonb),public.fail_marketplace_oauth(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_marketplace_oauth(jsonb,text,text,uuid),public.claim_marketplace_oauth(text,text,uuid),
  public.complete_marketplace_oauth(uuid,text,timestamptz,text,uuid,jsonb),public.fail_marketplace_oauth(uuid,uuid) TO service_role;
COMMIT;