BEGIN;
SET LOCAL lock_timeout = '5s';

-- Keep the admitted actor, expected snapshot, register authorization and financial guards.
-- Only a persisted marked Shop order may retain Shop as its cash-payment source.
CREATE OR REPLACE FUNCTION public.pos_checkout_commit_order(
  p_site_id uuid, p_mutation_id text, p_owner_token uuid, p_order_id uuid,
  p_sale_patch jsonb, p_order_patch jsonb, p_expected_sale jsonb, p_expected_order jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt public.pos_checkout_attempts%ROWTYPE; saved_order public.sale_orders%ROWTYPE;
  saved_sale public.sales%ROWTYPE; next_sale public.sales%ROWTYPE; next_order public.sale_orders%ROWTYPE;
  previous_claims text; previous_role text; previous_sub text;
  invalidate_mobile_checkout boolean := false;
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
  IF (next_sale.source IS DISTINCT FROM 'pos' AND NOT (
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
  IF public.is_self_service_order_items(saved_order.items)
    AND next_sale.amount_due < saved_sale.amount_due
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


CREATE OR REPLACE FUNCTION public.settle_stripe_sale_checkout(
  p_sale_id uuid,
  p_order_id uuid,
  p_session_id text,
  p_amount_minor bigint,
  p_currency text,
  p_payment_intent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_order public.sale_orders%ROWTYPE;
  v_effect public.stripe_sale_checkout_effects%ROWTYPE;
  v_currency text;
  v_expected_minor bigint;
  v_paid_amount numeric;
  v_payment jsonb;
  v_payments jsonb;
  v_payment_details jsonb;
  v_order_status text;
BEGIN
  IF nullif(trim(p_session_id), '') IS NULL
    OR p_amount_minor IS NULL
    OR p_amount_minor <= 0 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'invalid_session_payment'
    );
  END IF;

  SELECT *
  INTO v_effect
  FROM public.stripe_sale_checkout_effects
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;

  IF FOUND AND v_effect.settlement_status = 'rejected' THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', coalesce(v_effect.rejection_reason, 'previously_rejected')
    );
  END IF;
  IF v_effect.stripe_session_id IS NOT NULL
    AND (
      v_effect.sale_reference <> p_sale_id::text
      OR v_effect.order_id IS DISTINCT FROM p_order_id
      OR v_effect.payment_intent_id IS DISTINCT FROM p_payment_intent_id
      OR v_effect.amount_minor <> p_amount_minor
      OR v_effect.currency <> lower(trim(coalesce(p_currency, '')))
    ) THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'settlement_identity_mismatch'
    );
  END IF;

  -- Match admitted POS checkout/release lock order before locking its sale.
  -- The existing validation below still owns all settlement authorization.
  IF p_order_id IS NOT NULL THEN
    PERFORM id FROM public.sale_orders
      WHERE id=p_order_id AND sale_id=p_sale_id FOR UPDATE;
  END IF;

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'rejected', 'reason', 'sale_not_found');
  END IF;
  IF v_sale.stripe_checkout_session_id IS DISTINCT FROM p_session_id THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'checkout_session_replaced'
    );
  END IF;

  v_currency := lower(trim(coalesce(v_sale.currency, 'USD')));
  IF v_currency <> lower(trim(coalesce(p_currency, ''))) THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'currency_mismatch'
    );
  END IF;

  IF v_sale.amount_due IS NULL OR v_sale.amount_due <= 0 THEN
    IF v_sale.stripe_payment_intent_id IS NOT NULL
      AND v_sale.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id THEN
      RETURN jsonb_build_object(
        'status', 'rejected',
        'reason', 'payment_intent_mismatch'
      );
    END IF;

    IF p_order_id IS NOT NULL THEN
      SELECT *
      INTO v_order
      FROM public.sale_orders
      WHERE id = p_order_id
        AND sale_id = v_sale.id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'status', 'rejected',
          'reason', 'sale_order_not_found'
        );
      END IF;
    END IF;

    INSERT INTO public.stripe_sale_checkout_effects (
      stripe_session_id,
      sale_reference,
      sale_id,
      order_id,
      payment_intent_id,
      amount_minor,
      currency,
      settlement_status,
      financial_status,
      fulfillment_status,
      compensation_status
    )
    VALUES (
      p_session_id,
      p_sale_id::text,
      v_sale.id,
      p_order_id,
      coalesce(p_payment_intent_id, v_sale.stripe_payment_intent_id),
      p_amount_minor,
      v_currency,
      'settled',
      'pending',
      CASE WHEN p_order_id IS NULL THEN 'not_required' ELSE 'pending' END,
      'not_required'
    )
    ON CONFLICT (stripe_session_id) DO NOTHING;

    RETURN jsonb_build_object(
      'status', 'already_settled',
      'resume_effects', v_sale.status NOT IN ('cancelled', 'refunded'),
      'sale_id', v_sale.id,
      'site_id', v_sale.site_id,
      'lead_id', v_sale.lead_id,
      'order_id', p_order_id,
      'order_user_id',
        CASE WHEN p_order_id IS NULL THEN NULL ELSE v_order.user_id END,
      'order_buyer_user_id',
        CASE WHEN p_order_id IS NULL THEN NULL ELSE v_order.buyer_user_id END
    );
  END IF;

  IF v_sale.status IN ('cancelled', 'refunded')
    OR v_sale.status NOT IN ('pending', 'completed') THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'sale_not_payable'
    );
  END IF;

  v_expected_minor :=
    public.stripe_amount_to_minor(v_sale.amount_due, v_currency);
  IF v_expected_minor IS NULL OR v_expected_minor <> p_amount_minor THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'amount_mismatch'
    );
  END IF;

  IF p_order_id IS NULL AND EXISTS (
    SELECT 1 FROM public.sale_orders WHERE sale_id = v_sale.id
  ) THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'reason', 'sale_order_required'
    );
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT *
    INTO v_order
    FROM public.sale_orders
    WHERE id = p_order_id
      AND sale_id = v_sale.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'rejected',
        'reason', 'sale_order_not_found'
      );
    END IF;
    IF v_order.status IN ('cancelled', 'refunded')
      OR v_order.status NOT IN ('pending', 'completed') THEN
      RETURN jsonb_build_object(
        'status', 'rejected',
        'reason', 'sale_order_not_payable'
      );
    END IF;
  END IF;

  v_paid_amount := v_sale.amount_due;
  v_payment := jsonb_build_object(
    'method', 'stripe',
    'amount', v_paid_amount,
    'tendered', v_paid_amount,
    'change', 0,
    'date', now(),
    'status', 'completed',
    'stripe_session_id', p_session_id
  );
  IF p_payment_intent_id IS NOT NULL THEN
    v_payment := v_payment || jsonb_build_object(
      'stripe_payment_intent_id', p_payment_intent_id
    );
  END IF;
  v_payments := CASE
    WHEN jsonb_typeof(v_sale.payments) = 'array' THEN v_sale.payments
    ELSE '[]'::jsonb
  END;
  v_payment_details := CASE
    WHEN jsonb_typeof(v_sale.payment_details) = 'object'
      THEN v_sale.payment_details
    ELSE '{}'::jsonb
  END;
  v_payment_details := v_payment_details || jsonb_build_object(
    'processor', 'stripe',
    'stripe_checkout_session_id', p_session_id,
    'amount_total', p_amount_minor,
    'currency', v_currency,
    'stripe_payment_intent_id', p_payment_intent_id
  );

  UPDATE public.sales
  SET status = 'completed',
      amount_due = 0,
      payment_method = 'stripe',
      stripe_payment_intent_id = p_payment_intent_id,
      payment_details = v_payment_details,
      payments = v_payments || jsonb_build_array(v_payment),
      updated_at = now()
  WHERE id = v_sale.id;

  IF p_order_id IS NOT NULL THEN
    v_order_status := CASE
      WHEN v_order.status = 'completed'
        OR v_order.fulfillment_method = 'none' THEN 'completed'
      ELSE 'in_progress'
    END;
    UPDATE public.sale_orders
    SET status = v_order_status,
        updated_at = now()
    WHERE id = v_order.id;
  END IF;

  INSERT INTO public.stripe_sale_checkout_effects (
    stripe_session_id,
    sale_reference,
    sale_id,
    order_id,
    payment_intent_id,
    amount_minor,
    currency,
    settlement_status,
    fulfillment_status
  )
  VALUES (
    p_session_id,
    p_sale_id::text,
    v_sale.id,
    p_order_id,
    p_payment_intent_id,
    p_amount_minor,
    v_currency,
    'settled',
    CASE WHEN p_order_id IS NULL THEN 'not_required' ELSE 'pending' END
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'settled',
    'resume_effects', true,
    'sale_id', v_sale.id,
    'site_id', v_sale.site_id,
    'lead_id', v_sale.lead_id,
    'order_id', p_order_id,
    'order_user_id',
      CASE WHEN p_order_id IS NULL THEN NULL ELSE v_order.user_id END,
    'order_buyer_user_id',
      CASE WHEN p_order_id IS NULL THEN NULL ELSE v_order.buyer_user_id END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_stripe_sale_checkout(uuid,uuid,text,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stripe_sale_checkout(uuid,uuid,text,bigint,text,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
