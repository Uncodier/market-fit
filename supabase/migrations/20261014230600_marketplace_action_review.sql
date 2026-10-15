BEGIN;
CREATE OR REPLACE FUNCTION public.finish_marketplace_action(p_action_id uuid,p_result text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE operation public.marketplace_actions; native_order public.sale_orders;
  integration public.marketplace_integrations; marketplace jsonb; state text; native_status text;
BEGIN
  IF NOT public.marketplace_is_backend() THEN
    RAISE EXCEPTION 'Marketplace actions require backend' USING ERRCODE = '42501';
  END IF;
  IF p_result IS NULL OR p_result NOT IN ('confirmed','failed','unknown') OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid marketplace operation result';
  END IF;
  SELECT * INTO operation FROM public.marketplace_actions WHERE id = p_action_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Marketplace action not found'; END IF;
  -- Same lock order as authoritative webhook reconciliation: order then action.
  SELECT * INTO native_order FROM public.sale_orders WHERE id = operation.order_id FOR UPDATE;
  SELECT * INTO operation FROM public.marketplace_actions WHERE id = p_action_id FOR UPDATE;
  IF operation.status IN ('confirmed','failed') OR (operation.status = 'unknown' AND p_result = 'failed') THEN
    RETURN jsonb_build_object('order_id',operation.order_id,'operation',jsonb_build_object('action',operation.action,'status',operation.status));
  END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id = native_order.marketplace_integration_id;
  marketplace := native_order.metadata->'marketplace'; state := marketplace->>'state';
  IF p_result = 'confirmed' THEN
    IF native_order.status <> 'cancelled' AND state <> 'completed' THEN
      state := CASE operation.action WHEN 'accept' THEN CASE WHEN state = 'ready' THEN 'ready' ELSE 'accepted' END
        WHEN 'ready' THEN 'ready' WHEN 'reject' THEN 'rejected' WHEN 'cancel' THEN 'cancelled' END;
    END IF;
    -- Preserve the latest provider metadata; the request snapshot may be stale.
    -- Derive authoritative transitions and capabilities from the claimed action.
    marketplace := marketplace||jsonb_build_object('provider',integration.provider,
      'external_order_id',native_order.external_order_id,'external_store_id',integration.external_store_id,
      'state',state,'delivery_mode',coalesce(native_order.metadata#>>'{marketplace,delivery_mode}','marketplace_managed'),'sync_status','confirmed',
      'capabilities',public.marketplace_capabilities(integration.provider,state,integration.manual_ready));
    native_status := public.marketplace_native_state(state,integration.provider);
    IF state IN ('accepted','ready','completed') AND marketplace->>'accepted_at' IS NULL THEN
      marketplace := marketplace||jsonb_build_object('accepted_at',now());
    END IF;
    UPDATE public.sale_order_items SET status = CASE WHEN native_status = 'cancelled' THEN 'cancelled'
      WHEN native_status = 'draft' THEN 'draft' WHEN state IN ('ready','completed') THEN 'completed' ELSE 'new' END
      WHERE sale_order_id = native_order.id;
    IF native_status = 'cancelled' THEN UPDATE public.shipments SET status = 'cancelled'
      WHERE sale_order_id = native_order.id AND marketplace_integration_id IS NOT NULL; END IF;
  ELSE
    marketplace := marketplace||jsonb_build_object('sync_status',CASE WHEN p_result = 'unknown' THEN 'unknown' ELSE 'confirmed' END);
    native_status := native_order.status;
  END IF;
  marketplace := marketplace||jsonb_build_object('operation',jsonb_build_object('action',operation.action,'status',p_result));
  UPDATE public.marketplace_actions SET status = p_result,finished_at = now() WHERE id = operation.id;
  UPDATE public.sale_orders SET status = native_status,metadata = metadata||jsonb_build_object('marketplace',marketplace),updated_at = now()
    WHERE id = native_order.id;
  UPDATE public.shipments SET
    status = CASE WHEN status IN ('delivered','cancelled') THEN status
      WHEN native_status = 'cancelled' THEN 'cancelled'
      WHEN status = 'pending' AND state IN ('accepted','ready') AND p_result = 'confirmed' THEN 'preparing'
      ELSE status END,
    metadata = coalesce(metadata,'{}'::jsonb)||jsonb_build_object('marketplace',
      coalesce(metadata->'marketplace','{}'::jsonb)||jsonb_build_object(
        'state',state,'sync_status',marketplace->>'sync_status','operation',marketplace->'operation')),
    updated_at = now()
    WHERE sale_order_id = native_order.id AND marketplace_integration_id = integration.id;
  RETURN jsonb_build_object('order_id',operation.order_id,'operation',jsonb_build_object('action',operation.action,'status',p_result));
END;
$$;
REVOKE ALL ON FUNCTION public.finish_marketplace_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_marketplace_action(uuid,text,jsonb) TO service_role;
COMMIT;