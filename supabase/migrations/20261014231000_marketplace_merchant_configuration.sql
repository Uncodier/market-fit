BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.marketplace_integrations
  ALTER COLUMN secret_id DROP NOT NULL,
  ADD COLUMN credential_mode text NOT NULL DEFAULT 'custom' CHECK (credential_mode IN ('custom','platform')),
  ADD COLUMN merchant_connection_id uuid REFERENCES public.marketplace_merchant_connections(id),
  ADD COLUMN provisioning_status text NOT NULL DEFAULT 'active' CHECK (provisioning_status IN ('not_ready','pending','active','revoked')),
  ADD COLUMN provisioning_operation text CHECK (provisioning_operation IN ('activate','deactivate')),
  ADD COLUMN provisioning_result text CHECK (provisioning_result IN ('pending','unknown','confirmed','failed')),
  ADD COLUMN provisioning_claim_id uuid,
  ADD COLUMN provider_batch_id text CHECK (length(provider_batch_id) BETWEEN 1 AND 200),
  ADD CONSTRAINT marketplace_integration_credential_binding CHECK (
    (credential_mode='custom' AND (secret_id IS NOT NULL OR merchant_connection_id IS NOT NULL))
    OR (credential_mode='platform' AND secret_id IS NULL AND merchant_connection_id IS NOT NULL)),
  ADD CONSTRAINT marketplace_integration_provisioning_enabled CHECK (
    merchant_connection_id IS NULL OR NOT enabled OR provisioning_status IN ('active','pending'));
CREATE INDEX marketplace_integration_merchant_connection ON public.marketplace_integrations(merchant_connection_id)
  WHERE merchant_connection_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_marketplace_integration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE connection public.marketplace_merchant_connections;
BEGIN
  IF NOT public.marketplace_is_backend() THEN
    RAISE EXCEPTION 'Marketplace configuration is backend-owned' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.id,NEW.site_id,NEW.provider,NEW.environment,NEW.external_store_id,
    NEW.secret_id,NEW.created_by_user_id,NEW.credential_mode,NEW.merchant_connection_id) IS DISTINCT FROM
    (OLD.id,OLD.site_id,OLD.provider,OLD.environment,OLD.external_store_id,OLD.secret_id,
      OLD.created_by_user_id,OLD.credential_mode,OLD.merchant_connection_id) THEN
    RAISE EXCEPTION 'Marketplace integration identity is immutable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id=NEW.origin_location_id AND site_id=NEW.site_id AND is_active)
    THEN RAISE EXCEPTION 'Marketplace location tenant mismatch'; END IF;
  IF NEW.credential_mode='custom' AND NEW.secret_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.site_secrets WHERE id=NEW.secret_id
    AND site_id=NEW.site_id AND provider=NEW.provider AND use_case='marketplace:'||NEW.id::text AND instance_id IS NULL)
    THEN RAISE EXCEPTION 'Marketplace native secret tenant mismatch'; END IF;
  IF NEW.merchant_connection_id IS NOT NULL THEN
    SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=NEW.merchant_connection_id FOR SHARE;
    IF NOT FOUND OR (connection.site_id,connection.provider,connection.environment,connection.country,connection.credential_mode)
      IS DISTINCT FROM (NEW.site_id,NEW.provider,NEW.environment,NEW.country,NEW.credential_mode)
      OR (NEW.enabled AND connection.status<>'authorized')
      OR (TG_OP='INSERT' AND connection.status<>'authorized')
      OR ((TG_OP='INSERT' OR NEW.enabled) AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store WHERE store->>'id'=NEW.external_store_id))
      THEN RAISE EXCEPTION 'Marketplace merchant authorization mismatch'; END IF;
    IF TG_OP='UPDATE' AND NEW.country IS DISTINCT FROM OLD.country THEN
      RAISE EXCEPTION 'Merchant connection country is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_marketplace_integration(p_config jsonb,p_secret_id uuid,
  p_encrypted_credentials text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations; existing public.marketplace_integrations;
  integration_id uuid := (p_config->>'id')::uuid; site uuid := (p_config->>'site_id')::uuid;
  location uuid := (p_config->>'origin_location_id')::uuid;
  mode text := coalesce(p_config->>'credential_mode','custom');
  connection_id uuid := (p_config->>'merchant_connection_id')::uuid; target_enabled boolean;
BEGIN
  PERFORM public.marketplace_assert_actor(site,p_actor_user_id,true);
  IF integration_id IS NULL OR mode NOT IN ('custom','platform') OR NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id=location AND site_id=site AND is_active
  ) THEN RAISE EXCEPTION 'Invalid marketplace configuration'; END IF;
  SELECT * INTO existing FROM public.marketplace_integrations WHERE id=integration_id FOR UPDATE;
  IF FOUND AND (existing.site_id IS DISTINCT FROM site OR existing.secret_id IS DISTINCT FROM p_secret_id
    OR existing.provider IS DISTINCT FROM p_config->>'provider'
    OR existing.environment IS DISTINCT FROM p_config->>'environment'
    OR existing.external_store_id IS DISTINCT FROM p_config->>'external_store_id'
    OR existing.credential_mode IS DISTINCT FROM mode OR existing.merchant_connection_id IS DISTINCT FROM connection_id) THEN
    RAISE EXCEPTION 'Marketplace integration identity is immutable';
  END IF;
  IF mode='platform' THEN
    IF p_secret_id IS NOT NULL OR p_encrypted_credentials IS NOT NULL OR connection_id IS NULL THEN
      RAISE EXCEPTION 'Platform credentials must not be copied into site secrets';
    END IF;
  ELSE
    IF connection_id IS NOT NULL AND p_secret_id IS NULL THEN
      IF p_encrypted_credentials IS NOT NULL THEN RAISE EXCEPTION 'Merchant credentials are stored in the consent connection'; END IF;
    ELSIF p_secret_id IS NULL OR (existing.id IS NULL AND p_encrypted_credentials IS NULL) THEN
      RAISE EXCEPTION 'Encrypted marketplace credentials required';
    END IF;
    IF p_encrypted_credentials IS NOT NULL THEN
      IF length(p_encrypted_credentials) NOT BETWEEN 16 AND 32768 THEN RAISE EXCEPTION 'Invalid encrypted marketplace credentials'; END IF;
      IF EXISTS (SELECT 1 FROM public.site_secrets WHERE id=p_secret_id AND (
        site_id IS DISTINCT FROM site OR use_case IS DISTINCT FROM 'marketplace:'||integration_id::text
        OR provider IS DISTINCT FROM p_config->>'provider' OR instance_id IS NOT NULL
      )) THEN RAISE EXCEPTION 'Reserved secret identity mismatch'; END IF;
      INSERT INTO public.site_secrets(id,site_id,instance_id,name,provider,use_case,encrypted_value)
      VALUES(p_secret_id,site,NULL,'Marketplace credentials',p_config->>'provider',
        'marketplace:'||integration_id::text,p_encrypted_credentials)
      ON CONFLICT(id) DO UPDATE SET encrypted_value=excluded.encrypted_value,updated_at=now();
    END IF;
  END IF;
  -- Caller configuration cannot spoof provider confirmation or enable a store
  -- before provisioning. Legacy manually configured custom integrations remain compatible.
  target_enabled := coalesce((p_config->>'enabled')::boolean,false);
  IF connection_id IS NOT NULL THEN
    IF existing.id IS NULL THEN target_enabled := false;
    ELSIF target_enabled AND existing.provisioning_status<>'active' THEN target_enabled := existing.enabled;
    END IF;
  END IF;
  INSERT INTO public.marketplace_integrations(id,site_id,provider,environment,country,external_store_id,
    origin_location_id,secret_id,enabled,manual_ready,created_by_user_id,credential_mode,merchant_connection_id,provisioning_status)
  VALUES(integration_id,site,p_config->>'provider',p_config->>'environment',p_config->>'country',
    p_config->>'external_store_id',location,p_secret_id,target_enabled,
    coalesce((p_config->>'manual_ready')::boolean,false),p_actor_user_id,mode,connection_id,
    CASE WHEN existing.id IS NOT NULL THEN existing.provisioning_status
      WHEN connection_id IS NULL THEN 'active' ELSE 'not_ready' END)
  ON CONFLICT(id) DO UPDATE SET country=excluded.country,origin_location_id=excluded.origin_location_id,
    enabled=excluded.enabled,manual_ready=excluded.manual_ready,updated_at=now()
  RETURNING * INTO integration;
  RETURN to_jsonb(integration);
END;
$$;
REVOKE ALL ON FUNCTION public.validate_marketplace_integration(),public.save_marketplace_integration(jsonb,uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_marketplace_integration(jsonb,uuid,text,uuid) TO service_role;
COMMIT;