-- Server callbacks verify the app signature AND fetch authoritative live store
-- status before calling this RPC. A departed initiating manager is not consent.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.reconcile_marketplace_provider_status(p_integration_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations; connection public.marketplace_merchant_connections;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Provider status backend required' USING ERRCODE='42501'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('active','inactive','pending','failed') THEN RAISE EXCEPTION 'Invalid provider status'; END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF NOT FOUND OR integration.merchant_connection_id IS NULL THEN RAISE EXCEPTION 'Merchant integration unavailable'; END IF;
  SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=integration.merchant_connection_id FOR SHARE;
  IF NOT FOUND OR (connection.site_id,connection.provider,connection.environment,connection.country,connection.credential_mode)
    IS DISTINCT FROM (integration.site_id,integration.provider,integration.environment,integration.country,integration.credential_mode) THEN
    RAISE EXCEPTION 'Provider status authorization binding mismatch';
  END IF;
  IF p_status='active' THEN
    -- A provider still being active while disconnect is pending is not evidence
    -- that the local deactivation mutation failed. Never cancel its recovery.
    IF integration.provisioning_status='pending' AND integration.provisioning_operation='deactivate' THEN
      RETURN to_jsonb(integration);
    END IF;
    IF connection.status<>'authorized' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store
      WHERE store->>'id'=integration.external_store_id) THEN RAISE EXCEPTION 'Provider status authorization unavailable'; END IF;
    IF integration.provisioning_status='active' THEN RETURN to_jsonb(integration); END IF;
    IF integration.provisioning_status='pending' AND integration.provisioning_operation='activate' THEN
      RETURN public.apply_marketplace_provisioning(integration.id,'active');
    END IF;
    -- A previously completed/revoked receiver is not resurrected by a stale
    -- event. Explicit verified reauthorization starts a new activation claim.
    RETURN to_jsonb(integration);
  ELSIF p_status='inactive' THEN
    IF integration.provisioning_status='pending' AND integration.provisioning_operation='activate' THEN
      RETURN to_jsonb(integration);
    END IF;
    IF integration.provisioning_status='revoked' AND NOT integration.enabled THEN RETURN to_jsonb(integration); END IF;
    UPDATE public.marketplace_integrations SET enabled=false,provisioning_status='revoked',
      provisioning_operation='deactivate',provisioning_result='confirmed',updated_at=now()
      WHERE id=integration.id RETURNING * INTO integration;
  ELSIF p_status='pending' THEN
    IF integration.provisioning_status='pending' THEN RETURN to_jsonb(integration); END IF;
    IF connection.status<>'authorized' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store
      WHERE store->>'id'=integration.external_store_id) THEN RAISE EXCEPTION 'Provider status authorization unavailable'; END IF;
    UPDATE public.marketplace_integrations SET provisioning_status='pending',provisioning_operation='activate',
      provisioning_result='unknown',provisioning_claim_id=gen_random_uuid(),provider_batch_id=NULL,updated_at=now()
      WHERE id=integration.id RETURNING * INTO integration;
  ELSE
    IF integration.provisioning_status='pending' THEN RETURN public.apply_marketplace_provisioning(integration.id,'failed'); END IF;
  END IF;
  RETURN to_jsonb(integration);
END;
$$;

-- App signature-authorized callbacks may register missing webhook settings
-- without impersonating the manager who originally connected the store.
CREATE FUNCTION public.claim_marketplace_webhook_registration(p_app_hash text,p_provider text,p_environment text,p_country text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE lease public.marketplace_webhook_registration_apps; acquired boolean := true;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Webhook backend required' USING ERRCODE='42501'; END IF;
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
CREATE OR REPLACE FUNCTION public.claim_marketplace_webhook_registration(p_app_hash text,p_provider text,p_environment text,
  p_country text,p_actor_user_id uuid,p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.marketplace_assert_actor(p_site_id,p_actor_user_id,true);
  RETURN public.claim_marketplace_webhook_registration(p_app_hash,p_provider,p_environment,p_country);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_marketplace_provider_status(uuid,text),
  public.claim_marketplace_webhook_registration(text,text,text,text),
  public.claim_marketplace_webhook_registration(text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_marketplace_provider_status(uuid,text),
  public.claim_marketplace_webhook_registration(text,text,text,text),
  public.claim_marketplace_webhook_registration(text,text,text,text,uuid,uuid) TO service_role;
COMMIT;