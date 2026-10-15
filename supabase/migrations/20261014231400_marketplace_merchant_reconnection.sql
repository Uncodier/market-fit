-- Explicit reauthorization preserves native order/courier identities. No old
-- revoked authorization is resurrected and no provider call occurs in this RPC.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- The GUC is a transaction-local signal, not authorization. Only the definer
-- RPC can insert its matching single-update permit; service callers cannot forge
-- a permit by setting custom GUCs or directly writing this private table.
CREATE TABLE public.marketplace_rebind_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backend_pid integer NOT NULL,
  transaction_id bigint NOT NULL,
  integration_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  actor_user_id uuid NOT NULL
);
ALTER TABLE public.marketplace_rebind_permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_rebind_permits FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_marketplace_integration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE connection public.marketplace_merchant_connections; binding_changed boolean := false;
BEGIN
  IF NOT public.marketplace_is_backend() THEN
    RAISE EXCEPTION 'Marketplace configuration is backend-owned' USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.site_id,NEW.provider,NEW.environment,NEW.external_store_id,NEW.created_by_user_id)
      IS DISTINCT FROM (OLD.id,OLD.site_id,OLD.provider,OLD.environment,OLD.external_store_id,OLD.created_by_user_id) THEN
      RAISE EXCEPTION 'Marketplace integration identity is immutable';
    END IF;
    binding_changed := (NEW.secret_id,NEW.credential_mode,NEW.merchant_connection_id)
      IS DISTINCT FROM (OLD.secret_id,OLD.credential_mode,OLD.merchant_connection_id);
    IF binding_changed AND NOT EXISTS (SELECT 1 FROM public.marketplace_rebind_permits permit
      WHERE permit.id::text=current_setting('marketplace.rebind',true) AND permit.backend_pid=pg_backend_pid()
        AND permit.transaction_id=txid_current() AND permit.integration_id=NEW.id
        AND permit.connection_id=NEW.merchant_connection_id AND NEW.secret_id IS NULL) THEN
      RAISE EXCEPTION 'Marketplace integration identity is immutable';
    END IF;
    IF (binding_changed OR OLD.merchant_connection_id IS NOT NULL OR NEW.merchant_connection_id IS NOT NULL)
      AND NEW.country IS DISTINCT FROM OLD.country THEN RAISE EXCEPTION 'Merchant connection country is immutable'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id=NEW.origin_location_id AND site_id=NEW.site_id AND is_active)
    THEN RAISE EXCEPTION 'Marketplace location tenant mismatch'; END IF;
  IF NEW.credential_mode='custom' AND NEW.secret_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.site_secrets
    WHERE id=NEW.secret_id AND site_id=NEW.site_id AND provider=NEW.provider
      AND use_case='marketplace:'||NEW.id::text AND instance_id IS NULL) THEN
    RAISE EXCEPTION 'Marketplace native secret tenant mismatch';
  END IF;
  IF NEW.merchant_connection_id IS NOT NULL THEN
    SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=NEW.merchant_connection_id FOR SHARE;
    IF NOT FOUND OR (connection.site_id,connection.provider,connection.environment,connection.country,connection.credential_mode)
      IS DISTINCT FROM (NEW.site_id,NEW.provider,NEW.environment,NEW.country,NEW.credential_mode)
      OR ((NEW.enabled OR TG_OP='INSERT' OR binding_changed) AND connection.status<>'authorized')
      OR ((TG_OP='INSERT' OR NEW.enabled OR binding_changed) AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store WHERE store->>'id'=NEW.external_store_id)) THEN
      RAISE EXCEPTION 'Marketplace merchant authorization mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.rebind_marketplace_merchant_connection(p_integration_id uuid,p_connection_id uuid,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations; connection public.marketplace_merchant_connections;
  previous public.marketplace_merchant_connections; preserve_state boolean; permit_id uuid;
  prior_guard text := current_setting('marketplace.rebind',true);
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Merchant backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merchant integration unavailable'; END IF;
  PERFORM public.marketplace_assert_actor(integration.site_id,p_actor_user_id,true);
  SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=p_connection_id FOR SHARE;
  IF NOT FOUND OR (connection.site_id,connection.provider,connection.environment,connection.country)
    IS DISTINCT FROM (integration.site_id,integration.provider,integration.environment,integration.country)
    OR connection.status<>'authorized' OR (connection.token_expires_at IS NOT NULL AND connection.token_expires_at<=now())
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store
      WHERE store->>'id'=integration.external_store_id) THEN
    RAISE EXCEPTION 'Merchant reauthorization binding mismatch' USING ERRCODE='42501';
  END IF;
  IF integration.merchant_connection_id=connection.id THEN RETURN to_jsonb(integration); END IF;
  SELECT * INTO previous FROM public.marketplace_merchant_connections WHERE id=integration.merchant_connection_id FOR SHARE;
  preserve_state := integration.provisioning_status IN ('active','pending') OR integration.provisioning_result='unknown';
  IF preserve_state THEN
    IF previous.id IS NULL THEN
      -- Legacy app identity cannot be proved from native ciphertext in SQL.
      -- Require the manager to disable its manual receiver before migration.
      IF integration.enabled OR integration.provisioning_status='pending' OR integration.provisioning_result='unknown' THEN
        RAISE EXCEPTION 'Disconnect the existing provider app before changing authorization';
      END IF;
      preserve_state := false;
    ELSIF previous.app_client_id_hash IS DISTINCT FROM connection.app_client_id_hash THEN
      RAISE EXCEPTION 'Disconnect the existing provider app before changing authorization';
    END IF;
  END IF;
  INSERT INTO public.marketplace_rebind_permits(backend_pid,transaction_id,integration_id,connection_id,actor_user_id)
  VALUES(pg_backend_pid(),txid_current(),integration.id,connection.id,p_actor_user_id) RETURNING id INTO permit_id;
  PERFORM set_config('marketplace.rebind',permit_id::text,true);
  UPDATE public.marketplace_integrations SET merchant_connection_id=connection.id,credential_mode=connection.credential_mode,
    secret_id=NULL,enabled=CASE WHEN preserve_state THEN enabled ELSE false END,
    provisioning_status=CASE WHEN preserve_state THEN provisioning_status ELSE 'not_ready' END,
    provisioning_operation=CASE WHEN preserve_state THEN provisioning_operation ELSE NULL END,
    provisioning_result=CASE WHEN preserve_state THEN provisioning_result ELSE NULL END,
    provisioning_claim_id=CASE WHEN preserve_state THEN provisioning_claim_id ELSE NULL END,
    provider_batch_id=CASE WHEN preserve_state THEN provider_batch_id ELSE NULL END,updated_at=now()
    WHERE id=integration.id RETURNING * INTO integration;
  DELETE FROM public.marketplace_rebind_permits WHERE id=permit_id;
  PERFORM set_config('marketplace.rebind',coalesce(prior_guard,''),true);
  RETURN to_jsonb(integration);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('marketplace.rebind',coalesce(prior_guard,''),true);
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_marketplace_integration(),
  public.rebind_marketplace_merchant_connection(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rebind_marketplace_merchant_connection(uuid,uuid,uuid) TO service_role;
COMMIT;