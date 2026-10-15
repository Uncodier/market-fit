-- A live provider status read and a signed asynchronous event are distinct
-- proofs. Only the manager-authorized server status path may omit a lost batch.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.reconcile_marketplace_provisioning_status(p_integration_id uuid,p_actor_user_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations; connection public.marketplace_merchant_connections;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Provisioning backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF NOT FOUND OR integration.merchant_connection_id IS NULL THEN RAISE EXCEPTION 'Merchant integration unavailable'; END IF;
  PERFORM public.marketplace_assert_actor(integration.site_id,p_actor_user_id,true);
  IF p_status IS NULL OR p_status NOT IN ('active','revoked','failed') THEN RAISE EXCEPTION 'Invalid provisioning status'; END IF;
  SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=integration.merchant_connection_id FOR SHARE;
  IF NOT FOUND OR (connection.site_id,connection.provider,connection.environment,connection.country,connection.credential_mode)
    IS DISTINCT FROM (integration.site_id,integration.provider,integration.environment,integration.country,integration.credential_mode)
    THEN RAISE EXCEPTION 'Merchant status authorization mismatch'; END IF;
  IF p_status='active' AND (connection.status<>'authorized' OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store WHERE store->>'id'=integration.external_store_id)) THEN
    RAISE EXCEPTION 'Merchant status authorization unavailable';
  END IF;
  IF integration.provisioning_status='pending' AND (
    integration.provisioning_operation IS NULL
    OR (p_status='active' AND integration.provisioning_operation<>'activate')
    OR (p_status='revoked' AND integration.provisioning_operation<>'deactivate')) THEN
    RAISE EXCEPTION 'Provisioning operation mismatch';
  END IF;
  -- The caller performs a fresh authoritative read through this exact app and
  -- store and completes required webhook registration before reporting active.
  -- Token expiry does not revoke already provisioned operational app access.
  -- This intentionally does not weaken signed-event batch matching.
  RETURN public.apply_marketplace_provisioning(integration.id,p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_marketplace_provisioning_status(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_marketplace_provisioning_status(uuid,uuid,text) TO service_role;
COMMIT;