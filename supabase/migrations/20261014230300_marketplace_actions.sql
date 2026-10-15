BEGIN;
CREATE FUNCTION public.claim_marketplace_action(p_order_id uuid,p_action text,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE native_order public.sale_orders; integration public.marketplace_integrations;
  operation public.marketplace_actions; marketplace jsonb; actor_role text;
BEGIN
  IF NOT public.marketplace_is_backend() THEN
    RAISE EXCEPTION 'Marketplace actions require backend' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO native_order FROM public.sale_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR native_order.marketplace_integration_id IS NULL THEN RAISE EXCEPTION 'Marketplace order not found'; END IF;
  PERFORM public.marketplace_assert_actor(native_order.site_id,p_actor_user_id,false);
  IF EXISTS (SELECT 1 FROM public.site_members WHERE site_id = native_order.site_id AND user_id = p_actor_user_id
    AND restrict_to_assigned_only AND role NOT IN ('owner','admin'))
    AND NOT EXISTS (SELECT 1 FROM public.sites WHERE id = native_order.site_id AND user_id = p_actor_user_id)
    AND NOT EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = native_order.site_id AND user_id = p_actor_user_id) THEN
    RAISE EXCEPTION 'Marketplace operator must be assigned to this order' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO operation FROM public.marketplace_actions
    WHERE order_id = p_order_id AND status IN ('pending','unknown');
  IF FOUND THEN RETURN jsonb_build_object('action_id',operation.id,'duplicate',true,'order',to_jsonb(native_order),
    'operation',jsonb_build_object('action',operation.action,'status',operation.status)); END IF;
  SELECT * INTO integration FROM public.marketplace_integrations WHERE id = native_order.marketplace_integration_id;
  marketplace := native_order.metadata->'marketplace';
  IF NOT integration.enabled OR p_action IS NULL OR p_action NOT IN ('accept','reject','ready','cancel')
    OR marketplace->>'sync_status' IS DISTINCT FROM 'confirmed'
    OR marketplace->>'state' IN ('scheduled','rejected','cancelled','completed')
    OR coalesce((marketplace->>'totals_provisional')::boolean,false)
    OR (marketplace#>>ARRAY['capabilities',p_action])::boolean IS DISTINCT FROM true
    OR (public.marketplace_capabilities(integration.provider,marketplace->>'state',integration.manual_ready)->>p_action)::boolean IS DISTINCT FROM true
    OR (p_action IN ('accept','reject') AND marketplace->>'accept_by' IS NOT NULL
      AND (marketplace->>'accept_by')::timestamptz <= now()) THEN
    RAISE EXCEPTION 'Marketplace action unavailable';
  END IF;
  INSERT INTO public.marketplace_actions(order_id,actor_user_id,action) VALUES(p_order_id,p_actor_user_id,p_action)
    RETURNING * INTO operation;
  marketplace := marketplace||jsonb_build_object('sync_status','pending','operation',
    jsonb_build_object('action',p_action,'status','pending'));
  UPDATE public.sale_orders SET metadata = metadata||jsonb_build_object('marketplace',marketplace),updated_at = now()
    WHERE id = p_order_id RETURNING * INTO native_order;
  RETURN jsonb_build_object('action_id',operation.id,'duplicate',false,'order',to_jsonb(native_order),
    'operation',jsonb_build_object('action',p_action,'status','pending'));
END;
$$;
REVOKE ALL ON FUNCTION public.claim_marketplace_action(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketplace_action(uuid,text,uuid) TO service_role;

CREATE FUNCTION public.finish_marketplace_action(p_action_id uuid,p_result text,p_metadata jsonb DEFAULT '{}'::jsonb)
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
    -- Client metadata can add display details but never alter external identity,
    -- authoritative transition, provider capabilities, or payment settlement.
    marketplace := marketplace||p_metadata||jsonb_build_object('provider',integration.provider,
      'external_order_id',native_order.external_order_id,'external_store_id',integration.external_store_id,
      'state',state,'delivery_mode',coalesce(native_order.metadata#>>'{marketplace,delivery_mode}','marketplace_managed'),'sync_status','confirmed',
      'capabilities',public.marketplace_capabilities(integration.provider,state,integration.manual_ready));
    native_status := public.marketplace_native_state(state,integration.provider);
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
  RETURN jsonb_build_object('order_id',operation.order_id,'operation',jsonb_build_object('action',operation.action,'status',p_result));
END;
$$;
REVOKE ALL ON FUNCTION public.finish_marketplace_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_marketplace_action(uuid,text,jsonb) TO service_role;
COMMIT;