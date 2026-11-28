BEGIN;
SET LOCAL lock_timeout = '5s';

-- Not a general reset/retry. Only the authenticated POS operation server sends
-- this RPC, after fingerprinting the original write-free-preparation payload.
-- Existing-order payment + its attempt.sale_id are written in ONE transaction
-- by pos_checkout_commit_order. Finalization runs only after that RPC returns.
CREATE FUNCTION public.pos_checkout_recover_cash(
  p_site_id uuid, p_mutation_id text, p_owner_token uuid, p_order_id uuid,
  p_sale_patch jsonb, p_order_patch jsonb, p_expected_sale jsonb, p_expected_order jsonb,
  p_actor_id uuid, p_fingerprint text, p_baseline jsonb, p_payment_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE a public.pos_checkout_attempts%ROWTYPE; o public.sale_orders%ROWTYPE; s public.sales%ROWTYPE;
  order_fields jsonb; line_fields jsonb; baseline_lines jsonb; receipt jsonb; paid numeric;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server checkout recovery required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM public.pos_checkout_attempts WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id FOR UPDATE;
  IF NOT FOUND OR a.state <> 'review_required' OR a.result IS NOT NULL OR a.sale_id IS NOT NULL
    OR a.cancelled_at IS NOT NULL OR a.actor_id IS DISTINCT FROM p_actor_id OR a.fingerprint IS DISTINCT FROM p_fingerprint
    OR a.requested_order_id IS DISTINCT FROM p_order_id OR a.order_id IS DISTINCT FROM p_order_id
    OR p_owner_token IS NULL OR p_owner_token=a.owner_token OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Original precommit cash attempt required' USING ERRCODE='23514';
  END IF;
  SELECT * INTO STRICT o FROM public.sale_orders WHERE site_id=p_site_id AND id=p_order_id FOR UPDATE;
  SELECT * INTO STRICT s FROM public.sales WHERE site_id=p_site_id AND id=o.sale_id FOR UPDATE;
  IF s.source IS DISTINCT FROM 'shop' OR s.status IS DISTINCT FROM 'pending' OR o.promotion_id IS NULL
    OR (o.discount_total>0 AND o.total>0 AND s.amount=s.amount_due AND s.amount=o.total) IS NOT TRUE
    OR s.payments IS DISTINCT FROM '[]'::jsonb OR (o.status IN ('pending','in_progress','completed')) IS NOT TRUE
    OR public.is_self_service_order_items(o.items) OR public.is_self_service_order_items(p_order_patch->'items')
    OR EXISTS (SELECT 1 FROM public.pos_client_mutations WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id)
    OR EXISTS (SELECT 1 FROM public.pos_register_receipts WHERE id=p_payment_id OR sale_id=s.id) THEN
    RAISE EXCEPTION 'Order is not a verified unpaid Shop promotion checkout' USING ERRCODE='23514';
  END IF;

  -- Match the financial posOrderVersion, not a regenerated snapshot of
  -- the edited cart. Lock children as well as the referenced parent before use.
  PERFORM 1 FROM public.sale_order_items WHERE sale_order_id=o.id ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.sale_order_items WHERE sale_order_id=o.id AND
      (site_id IS DISTINCT FROM p_site_id OR metadata @> '{"self_service":true}'::jsonb)) THEN
    RAISE EXCEPTION 'Order lines cannot be recovered' USING ERRCODE='23514';
  END IF;
  SELECT jsonb_object_agg(key,value) INTO order_fields FROM jsonb_each(to_jsonb(o))
    WHERE key=ANY(ARRAY['id','site_id','sale_id','status','currency','subtotal','tax_total','discount_total','total',
      'price_list_id','promotion_id','fulfillment_method','origin_location_id','buyer_user_id','seller_user_id',
      'scheduled_for','shipping_address','notes']);
  -- Match posOrderMatchesVersion: kitchen-only progress is not a financial
  -- change. The original snapshot must still identify the same lines, including
  -- cancellations. Normalize timestamp offsets to the same database instant.
  IF (p_baseline->>'status' IN ('pending','in_progress','completed')) IS NOT TRUE
    OR (p_baseline->>'scheduled_for')::timestamptz IS DISTINCT FROM o.scheduled_for THEN
    RAISE EXCEPTION 'Original order baseline changed' USING ERRCODE='40001';
  END IF;
  SELECT jsonb_agg(item || jsonb_build_object('status',CASE WHEN item->>'status'='cancelled' THEN 'cancelled' ELSE 'active' END)
    ORDER BY idx) INTO baseline_lines FROM jsonb_array_elements(p_baseline->'items') WITH ORDINALITY t(item,idx);
  SELECT jsonb_agg(jsonb_build_object('id',id,'catalog_item_id',catalog_item_id,'quantity',quantity,'unit_price',unit_price,
    'status',CASE WHEN status='cancelled' THEN 'cancelled' ELSE 'active' END,'parent_sale_order_item_id',parent_sale_order_item_id,'client_line_key',metadata->'client_line_key',
    'modifier_group_id',metadata->'modifier_group_id') ORDER BY id) INTO line_fields FROM public.sale_order_items WHERE sale_order_id=o.id;
  IF line_fields IS NULL OR (p_baseline || jsonb_build_object('items',baseline_lines)) IS DISTINCT FROM
    (order_fields || jsonb_build_object('status',p_baseline->'status','scheduled_for',p_baseline->'scheduled_for','items',line_fields,'lead_id',s.lead_id,
      'sale',jsonb_build_object('status',s.status,'amount',s.amount,'amount_due',s.amount_due,'payments',s.payments))) THEN
    RAISE EXCEPTION 'Original order baseline changed' USING ERRCODE='40001';
  END IF;

  receipt := p_sale_patch->'payments'->0;
  paid := (receipt->>'amount')::numeric;
  IF jsonb_array_length(p_sale_patch->'payments') IS DISTINCT FROM 1 OR receipt->>'method' IS DISTINCT FROM 'cash'
    OR (receipt->>'payment_id')::uuid IS DISTINCT FROM p_payment_id OR (receipt->>'recorded_by')::uuid IS DISTINCT FROM p_actor_id
    OR (receipt->>'register_session_id') IS NULL OR receipt->>'status' IS DISTINCT FROM 'completed'
    OR p_sale_patch->>'source' IS DISTINCT FROM 'shop' OR (p_order_patch->>'promotion_id')::uuid IS DISTINCT FROM o.promotion_id
    OR (p_order_patch->>'discount_total')::numeric IS DISTINCT FROM o.discount_total
    OR (paid>0 AND paid=(p_sale_patch->>'amount')::numeric AND paid=(p_order_patch->>'total')::numeric
        AND (p_sale_patch->>'amount_due')::numeric=0) IS NOT TRUE THEN
    RAISE EXCEPTION 'Full original cash receipt required' USING ERRCODE='23514';
  END IF;

  -- Old owner is fenced. Any register/financial/actor/snapshot failure in the
  -- existing commit rolls this transition back, retaining review_required.
  UPDATE public.pos_checkout_attempts SET state='writes_started',owner_token=p_owner_token,updated_at=clock_timestamp()
    WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id;
  RETURN public.pos_checkout_commit_order(p_site_id,p_mutation_id,p_owner_token,p_order_id,
    p_sale_patch,p_order_patch,p_expected_sale,p_expected_order);
END;
$$;
REVOKE ALL ON FUNCTION public.pos_checkout_recover_cash(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,text,jsonb,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_checkout_recover_cash(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,uuid,text,jsonb,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;