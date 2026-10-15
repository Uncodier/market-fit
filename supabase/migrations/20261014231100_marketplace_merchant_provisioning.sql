BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE FUNCTION public.claim_marketplace_provisioning(p_integration_id uuid,p_operation text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations; connection public.marketplace_merchant_connections;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Provisioning backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF NOT FOUND OR integration.merchant_connection_id IS NULL THEN RAISE EXCEPTION 'Merchant integration unavailable'; END IF;
  PERFORM public.marketplace_assert_actor(integration.site_id,p_actor_user_id,true);
  IF p_operation IS NULL OR p_operation NOT IN ('activate','deactivate') THEN RAISE EXCEPTION 'Invalid provisioning operation'; END IF;
  IF integration.provisioning_status='pending' THEN
    RETURN jsonb_build_object('batch_id',integration.provisioning_claim_id,'duplicate',true,'integration',to_jsonb(integration));
  END IF;
  SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=integration.merchant_connection_id FOR SHARE;
  IF connection.status<>'authorized' OR (connection.token_expires_at IS NOT NULL AND connection.token_expires_at<=now())
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(connection.authorized_stores) store WHERE store->>'id'=integration.external_store_id)
    THEN RAISE EXCEPTION 'Merchant authorization unavailable'; END IF;
  IF (p_operation='activate' AND integration.provisioning_status='active')
    OR (p_operation='deactivate' AND integration.provisioning_status='revoked') THEN
    RETURN jsonb_build_object('batch_id',integration.provisioning_claim_id,'duplicate',true,'integration',to_jsonb(integration));
  END IF;
  UPDATE public.marketplace_integrations SET provisioning_status='pending',provisioning_operation=p_operation,
    provisioning_claim_id=gen_random_uuid(),provider_batch_id=NULL,provisioning_result='pending',
    enabled=CASE WHEN p_operation='activate' THEN true ELSE enabled END,updated_at=now()
    WHERE id=integration.id RETURNING * INTO integration;
  RETURN jsonb_build_object('batch_id',integration.provisioning_claim_id,'duplicate',false,'integration',to_jsonb(integration));
END;
$$;

-- This internal transition function is not an API grant. Its callers validate
-- either the manager claim or a server-verified app-scoped provider event.
CREATE FUNCTION public.apply_marketplace_provisioning(p_integration_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations;
BEGIN
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF p_status NOT IN ('active','revoked','failed') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid provisioning status'; END IF;
  IF integration.provisioning_status<>'pending' THEN RETURN to_jsonb(integration); END IF;
  IF (p_status='active' AND integration.provisioning_operation<>'activate')
    OR (p_status='revoked' AND integration.provisioning_operation<>'deactivate') THEN
    RAISE EXCEPTION 'Provisioning operation mismatch';
  END IF;
  UPDATE public.marketplace_integrations SET
    provisioning_status=CASE WHEN p_status='failed' THEN 'not_ready' ELSE p_status END,
    provisioning_result=CASE WHEN p_status='failed' THEN 'failed' ELSE 'confirmed' END,
    enabled=p_status='active',updated_at=now()
    WHERE id=integration.id RETURNING * INTO integration;
  RETURN to_jsonb(integration);
END;
$$;
CREATE FUNCTION public.finish_marketplace_provisioning(p_integration_id uuid,p_batch_id uuid,
  p_result text,p_actor_user_id uuid,p_provider_batch_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Provisioning backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF NOT FOUND OR integration.merchant_connection_id IS NULL OR integration.provisioning_claim_id IS DISTINCT FROM p_batch_id
    OR p_batch_id IS NULL THEN RAISE EXCEPTION 'Provisioning claim unavailable'; END IF;
  PERFORM public.marketplace_assert_actor(integration.site_id,p_actor_user_id,true);
  IF p_result IS NULL OR p_result NOT IN ('confirmed','failed','unknown','pending') THEN RAISE EXCEPTION 'Invalid provisioning result'; END IF;
  IF integration.provisioning_status<>'pending' THEN RETURN to_jsonb(integration); END IF;
  -- A later transport failure is not proof that an earlier unknown provider
  -- mutation did not happen. Only authoritative event/status reconciliation or
  -- explicit confirmation may resolve this durable uncertainty.
  IF integration.provisioning_result='unknown' AND p_result='failed' THEN RETURN to_jsonb(integration); END IF;
  IF p_provider_batch_id IS NOT NULL THEN
    IF integration.provider_batch_id IS NOT NULL AND integration.provider_batch_id<>p_provider_batch_id THEN
      RAISE EXCEPTION 'Provider batch identity is immutable';
    END IF;
    UPDATE public.marketplace_integrations SET provider_batch_id=p_provider_batch_id WHERE id=integration.id;
  END IF;
  IF p_result IN ('pending','unknown') THEN
    UPDATE public.marketplace_integrations SET provisioning_result=CASE
      WHEN provisioning_result='unknown' THEN 'unknown' ELSE p_result END WHERE id=integration.id;
    SELECT * INTO integration FROM public.marketplace_integrations WHERE id=integration.id;
    RETURN to_jsonb(integration);
  END IF;
  RETURN public.apply_marketplace_provisioning(integration.id,CASE WHEN p_result='failed' THEN 'failed'
    WHEN integration.provisioning_operation='activate' THEN 'active' ELSE 'revoked' END);
END;
$$;
CREATE FUNCTION public.reconcile_marketplace_provisioning(p_integration_id uuid,p_provider_batch_id text,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Provisioning backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id=p_integration_id FOR UPDATE;
  IF NOT FOUND OR integration.merchant_connection_id IS NULL OR (integration.provider_batch_id IS NOT NULL
    AND integration.provider_batch_id IS DISTINCT FROM p_provider_batch_id) THEN
    RAISE EXCEPTION 'Provider provisioning identity mismatch';
  END IF;
  -- Uber provisioned events have no asynchronous batch id. Rappi batch ids must
  -- match the one persisted from the provider response, never an unrelated store.
  IF integration.provider='rappi' AND (p_provider_batch_id IS NULL OR integration.provider_batch_id IS NULL) THEN
    RAISE EXCEPTION 'Provider batch receipt unavailable';
  END IF;
  RETURN public.apply_marketplace_provisioning(integration.id,p_status);
END;
$$;
CREATE FUNCTION public.revoke_marketplace_merchant_connection(p_connection_id uuid,p_actor_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE connection public.marketplace_merchant_connections;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Merchant backend required' USING ERRCODE='42501'; END IF;
  SELECT * INTO connection FROM public.marketplace_merchant_connections WHERE id=p_connection_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merchant connection unavailable'; END IF;
  PERFORM public.marketplace_assert_actor(connection.site_id,p_actor_user_id,true);
  -- No remote mutation occurs here. The authorized backend calls this only after
  -- actual provider revocation/deactivation confirmation, never on unknown results.
  UPDATE public.marketplace_integrations SET enabled=false,provisioning_status='revoked',
    provisioning_result='confirmed',updated_at=now()
    WHERE merchant_connection_id=connection.id;
  UPDATE public.marketplace_merchant_connections SET status='revoked',encrypted_authorization=NULL,
    token_expires_at=NULL,updated_at=now() WHERE id=connection.id;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_marketplace_provisioning(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_marketplace_provisioning(uuid,text,uuid),
  public.finish_marketplace_provisioning(uuid,uuid,text,uuid,text),public.reconcile_marketplace_provisioning(uuid,text,text),
  public.revoke_marketplace_merchant_connection(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_provisioning(uuid,text,uuid),
  public.finish_marketplace_provisioning(uuid,uuid,text,uuid,text),public.reconcile_marketplace_provisioning(uuid,text,text),
  public.revoke_marketplace_merchant_connection(uuid,uuid) TO service_role;

-- Preserve the historical action/poll implementations while making consent and
-- confirmed activation mandatory for merchant-mode provider mutations/read polling.
-- Merchant OAuth token expiry restricts onboarding mutations, not operational
-- app-credential order access after durable merchant consent and activation.
ALTER FUNCTION public.claim_marketplace_action(uuid,text,uuid) RENAME TO claim_marketplace_action_active;
CREATE FUNCTION public.claim_marketplace_action(p_order_id uuid,p_action text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE integration public.marketplace_integrations;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Marketplace backend required' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO integration FROM public.marketplace_integrations i JOIN public.sale_orders o
    ON o.marketplace_integration_id=i.id WHERE o.id=p_order_id FOR SHARE OF i;
  IF integration.merchant_connection_id IS NOT NULL AND (integration.provisioning_status<>'active'
    OR NOT EXISTS (SELECT 1 FROM public.marketplace_merchant_connections c WHERE c.id=integration.merchant_connection_id
      AND c.status='authorized'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.authorized_stores) store WHERE store->>'id'=integration.external_store_id))) THEN
    RAISE EXCEPTION 'Marketplace merchant connection is not active';
  END IF;
  RETURN public.claim_marketplace_action_active(p_order_id,p_action,p_actor_user_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.claim_marketplace_poll(p_limit integer DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE claimed jsonb;
BEGIN
  IF NOT public.marketplace_is_backend() THEN RAISE EXCEPTION 'Marketplace polling requires backend' USING ERRCODE='42501'; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Invalid marketplace poll limit'; END IF;
  WITH eligible AS (
    SELECT i.id FROM public.marketplace_integrations i JOIN public.sites s ON s.id=i.site_id
    WHERE i.enabled AND s.archived_at IS NULL AND (i.last_polled_at IS NULL OR i.last_polled_at<=now()-interval '45 seconds')
      AND (i.merchant_connection_id IS NULL OR (i.provisioning_status='active' AND EXISTS (
        SELECT 1 FROM public.marketplace_merchant_connections c WHERE c.id=i.merchant_connection_id AND c.status='authorized'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.authorized_stores) store WHERE store->>'id'=i.external_store_id))))
    ORDER BY i.last_polled_at NULLS FIRST,i.id LIMIT p_limit FOR UPDATE OF i SKIP LOCKED
  ), changed AS (
    UPDATE public.marketplace_integrations i SET last_polled_at=now(),poll_sent_next=NOT i.poll_sent_next
    FROM eligible e WHERE i.id=e.id RETURNING i.id,i.provider,i.poll_sent_next
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('integration_id',id,'provider',provider,
    'order_list',CASE WHEN poll_sent_next THEN 'new' ELSE 'sent' END)),'[]'::jsonb) INTO claimed FROM changed;
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_marketplace_action_active(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_marketplace_action(uuid,text,uuid),public.claim_marketplace_poll(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_action(uuid,text,uuid),public.claim_marketplace_poll(integer) TO service_role;
COMMIT;