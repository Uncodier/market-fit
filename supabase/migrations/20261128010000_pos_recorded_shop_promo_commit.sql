BEGIN;
SET LOCAL lock_timeout = '5s';

-- Keep the admitted actor, expected snapshot, register authorization and financial guards.
-- Preserve Shop attribution for an existing, unchanged recorded promotion as well.
CREATE OR REPLACE FUNCTION public.pos_checkout_commit_order(
  p_site_id uuid, p_mutation_id text, p_owner_token uuid, p_order_id uuid,
  p_sale_patch jsonb, p_order_patch jsonb, p_expected_sale jsonb, p_expected_order jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt public.pos_checkout_attempts%ROWTYPE; saved_order public.sale_orders%ROWTYPE;
  saved_sale public.sales%ROWTYPE; next_sale public.sales%ROWTYPE; next_order public.sale_orders%ROWTYPE;
  previous_claims text; previous_role text; previous_sub text;
  invalidate_mobile_checkout boolean := false;
  recorded_shop_promo boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server checkout commit required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO attempt FROM public.pos_checkout_attempts
    WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id AND owner_token=p_owner_token FOR UPDATE;
  IF NOT FOUND OR attempt.state <> 'writes_started' OR attempt.requested_order_id IS DISTINCT FROM p_order_id THEN
    RAISE EXCEPTION 'Checkout admission mismatch' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_sale_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_order_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid checkout patches' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO saved_order FROM public.sale_orders WHERE id=p_order_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout order unavailable' USING ERRCODE = '22023'; END IF;
  SELECT * INTO saved_sale FROM public.sales WHERE id=saved_order.sale_id AND site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout sale unavailable' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_expected_sale) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected_order) IS DISTINCT FROM 'object'
    OR NOT p_expected_sale ?& ARRAY['amount','amount_due','payments']
    OR NOT p_expected_order ?& ARRAY['sale_id','status','total','currency','notes','updated_at']
    OR to_jsonb(saved_sale)->'payments' IS DISTINCT FROM p_expected_sale->'payments'
    OR NOT to_jsonb(saved_sale) @> p_expected_sale OR NOT to_jsonb(saved_order) @> p_expected_order THEN
    RAISE EXCEPTION 'Checkout balance or order changed before commit' USING ERRCODE = '40001';
  END IF;
  next_sale := jsonb_populate_record(saved_sale,p_sale_patch);
  next_order := jsonb_populate_record(saved_order,p_order_patch);
  IF ROW(next_sale.id,next_sale.site_id,next_sale.location_id,next_sale.currency)
      IS DISTINCT FROM ROW(saved_sale.id,saved_sale.site_id,saved_sale.location_id,saved_sale.currency)
    OR ROW(next_order.id,next_order.site_id,next_order.sale_id)
      IS DISTINCT FROM ROW(saved_order.id,saved_order.site_id,saved_order.sale_id) THEN
    RAISE EXCEPTION 'Checkout scope is immutable' USING ERRCODE = '22023';
  END IF;
  recorded_shop_promo := saved_sale.source IS NOT DISTINCT FROM 'shop' AND next_sale.source IS NOT DISTINCT FROM 'shop'
    AND NOT public.is_self_service_order_items(saved_order.items) AND NOT public.is_self_service_order_items(next_order.items)
    AND saved_order.promotion_id IS NOT NULL AND saved_order.discount_total > 0
    AND next_order.promotion_id IS NOT DISTINCT FROM saved_order.promotion_id
    AND next_order.discount_total IS NOT DISTINCT FROM saved_order.discount_total
    AND next_order.buyer_user_id IS NOT DISTINCT FROM saved_order.buyer_user_id
    AND next_sale.lead_id IS NOT DISTINCT FROM saved_sale.lead_id
    AND next_order.fulfillment_method IS NOT DISTINCT FROM saved_order.fulfillment_method
    AND (saved_order.origin_location_id IS NULL OR next_order.origin_location_id IS NOT DISTINCT FROM saved_order.origin_location_id);
  IF (next_sale.source IS DISTINCT FROM 'pos' AND NOT coalesce(recorded_shop_promo,false) AND NOT (
      saved_sale.source = 'shop' AND next_sale.source = 'shop'
      AND public.is_self_service_order_items(saved_order.items)
      AND public.is_self_service_order_items(next_order.items)))
    OR (public.is_self_service_order_items(saved_order.items) AND next_sale.source IS DISTINCT FROM saved_sale.source)
    OR next_sale.amount IS NULL OR next_sale.amount_due IS NULL
    OR next_sale.amount::text IN ('NaN','Infinity','-Infinity') OR next_sale.amount_due::text IN ('NaN','Infinity','-Infinity')
    OR next_sale.amount < 0 OR next_sale.amount_due < 0
    OR next_sale.amount_due > next_sale.amount OR next_order.currency IS DISTINCT FROM saved_order.currency THEN
    RAISE EXCEPTION 'Invalid checkout financial state' USING ERRCODE = '22023';
  END IF;
  -- Cash winning the sale lock invalidates both an already linked mobile session
  -- and a reserved session still being created. A later verified Stripe charge
  -- must enter the existing rejected-settlement compensation/refund path.
  IF (recorded_shop_promo OR (public.is_self_service_order_items(saved_order.items)
    AND next_sale.amount_due < saved_sale.amount_due))
    AND next_sale.payments IS DISTINCT FROM saved_sale.payments
    AND jsonb_typeof(next_sale.payments) = 'array' THEN
    invalidate_mobile_checkout := EXISTS (
      SELECT 1 FROM jsonb_array_elements(next_sale.payments) payment
      WHERE payment->>'status' = 'completed' AND payment->>'method' <> 'stripe'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(saved_sale.payments)='array'
            THEN saved_sale.payments ELSE '[]'::jsonb END) prior WHERE prior=payment
        )
    );
  END IF;
  -- Existing register/accounting/attribution triggers derive the actor from JWT.
  -- Bind that actor to server-owned admission and reauthorize inside this transaction.
  previous_claims := current_setting('request.jwt.claims',true);
  previous_role := current_setting('request.jwt.claim.role',true);
  previous_sub := current_setting('request.jwt.claim.sub',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',attempt.actor_id,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',attempt.actor_id::text,true);
  PERFORM public.pos_register_authorize(p_site_id,attempt.actor_id);
  IF public.current_user_has_site_location_restrictions(p_site_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unrestricted checkout access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sales SET lead_id=next_sale.lead_id,buyer_user_id=next_sale.buyer_user_id,
    owner_site_id=next_sale.owner_site_id,campaign_id=next_sale.campaign_id,segment_id=next_sale.segment_id,
    company_id=next_sale.company_id,title=next_sale.title,product_name=next_sale.product_name,
    amount=next_sale.amount,amount_due=next_sale.amount_due,user_id=next_sale.user_id,
    sale_date=next_sale.sale_date,source=next_sale.source,status=next_sale.status,
    payments=next_sale.payments,payment_method=next_sale.payment_method,
    stripe_checkout_session_id=CASE WHEN invalidate_mobile_checkout THEN NULL ELSE saved_sale.stripe_checkout_session_id END,
    stripe_checkout_attempt=CASE WHEN invalidate_mobile_checkout THEN coalesce(saved_sale.stripe_checkout_attempt,0)+1
      ELSE saved_sale.stripe_checkout_attempt END
    WHERE id=saved_sale.id RETURNING * INTO saved_sale;
  UPDATE public.sale_orders SET price_list_id=next_order.price_list_id,buyer_user_id=next_order.buyer_user_id,
    owner_site_id=next_order.owner_site_id,fulfillment_method=next_order.fulfillment_method,
    origin_location_id=next_order.origin_location_id,shipping_address=next_order.shipping_address,
    scheduled_for=next_order.scheduled_for,subtotal=next_order.subtotal,tax_total=next_order.tax_total,
    shipping_cost=next_order.shipping_cost,total=next_order.total,currency=next_order.currency,
    discount_total=next_order.discount_total,promotion_id=next_order.promotion_id,status=next_order.status,
    user_id=next_order.user_id,seller_user_id=next_order.seller_user_id,
    requested_by_lead_id=next_order.requested_by_lead_id,items=next_order.items,notes=next_order.notes
    WHERE id=saved_order.id RETURNING * INTO saved_order;
  UPDATE public.pos_checkout_attempts SET order_id=saved_order.id,sale_id=saved_sale.id,
    updated_at=clock_timestamp() WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id;
  PERFORM set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  PERFORM set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
  PERFORM set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  RETURN jsonb_build_object('sale',to_jsonb(saved_sale),'order',to_jsonb(saved_order));
END;
$$;
REVOKE ALL ON FUNCTION public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;

COMMIT;
