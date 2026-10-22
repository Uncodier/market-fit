BEGIN;

-- Server-owned admission and outcome evidence. Never infer non-application from
-- an expired lease: a process may have committed writes before losing its response.
CREATE TABLE public.pos_checkout_attempts (
  site_id uuid NOT NULL REFERENCES public.sites(id),
  client_mutation_id text NOT NULL CHECK (length(client_mutation_id) BETWEEN 1 AND 128),
  actor_id uuid NOT NULL,
  requested_order_id uuid,
  order_id uuid,
  sale_id uuid,
  fingerprint text NOT NULL,
  owner_token uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('processing','writes_started','completed','rejected','review_required')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (site_id,client_mutation_id)
);
CREATE UNIQUE INDEX pos_checkout_one_unresolved_order
  ON public.pos_checkout_attempts(site_id,order_id)
  WHERE order_id IS NOT NULL AND state IN ('processing','writes_started','review_required');
ALTER TABLE public.pos_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_checkout_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pos_checkout_attempts TO service_role;

CREATE FUNCTION public.pos_checkout_claim(
  p_site_id uuid, p_mutation_id text, p_actor_id uuid, p_order_id uuid,
  p_fingerprint text, p_owner_token uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt public.pos_checkout_attempts%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server checkout admission required' USING ERRCODE = '42501';
  END IF;
  -- Both identity and order admission are serialized. Unique indexes remain the
  -- final guard when another server attempts a different key for the same order.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_mutation_id,0));
  SELECT * INTO attempt FROM public.pos_checkout_attempts
    WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id FOR UPDATE;
  IF FOUND THEN
    IF attempt.actor_id IS DISTINCT FROM p_actor_id OR attempt.fingerprint IS DISTINCT FROM p_fingerprint
      OR attempt.requested_order_id IS DISTINCT FROM p_order_id THEN
      RETURN jsonb_build_object('state','identity_conflict');
    END IF;
    RETURN jsonb_build_object('state',attempt.state,'result',attempt.result,
      'orderId',attempt.order_id,'saleId',attempt.sale_id);
  END IF;
  IF p_order_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':order:' || p_order_id::text,0));
    IF NOT EXISTS (SELECT 1 FROM public.sale_orders WHERE id=p_order_id AND site_id=p_site_id) THEN
      RETURN jsonb_build_object('state','identity_conflict');
    END IF;
    IF EXISTS (SELECT 1 FROM public.pos_checkout_attempts WHERE site_id=p_site_id AND order_id=p_order_id
      AND state IN ('processing','writes_started','review_required')) THEN
      RETURN jsonb_build_object('state','order_busy');
    END IF;
  END IF;
  INSERT INTO public.pos_checkout_attempts(site_id,client_mutation_id,actor_id,requested_order_id,order_id,fingerprint,owner_token,state)
    VALUES(p_site_id,p_mutation_id,p_actor_id,p_order_id,p_order_id,p_fingerprint,p_owner_token,'processing');
  RETURN jsonb_build_object('state','claimed');
END;
$$;

CREATE FUNCTION public.pos_checkout_transition(
  p_site_id uuid, p_mutation_id text, p_owner_token uuid, p_state text,
  p_order_id uuid DEFAULT NULL, p_sale_id uuid DEFAULT NULL, p_result jsonb DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt public.pos_checkout_attempts%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server checkout transition required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO attempt FROM public.pos_checkout_attempts
    WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id AND owner_token=p_owner_token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT ((attempt.state='processing' AND p_state IN ('writes_started','rejected'))
    OR (attempt.state='writes_started' AND p_state IN ('completed','review_required'))) THEN RETURN false; END IF;
  IF p_order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sale_orders WHERE id=p_order_id AND site_id=p_site_id)
    OR p_sale_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sales WHERE id=p_sale_id AND site_id=p_site_id) THEN
    RAISE EXCEPTION 'Checkout result scope mismatch' USING ERRCODE = '22023';
  END IF;
  UPDATE public.pos_checkout_attempts SET state=p_state,order_id=coalesce(p_order_id,order_id),
    sale_id=coalesce(p_sale_id,sale_id),result=p_result,updated_at=clock_timestamp()
    WHERE site_id=p_site_id AND client_mutation_id=p_mutation_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.pos_checkout_claim(uuid,text,uuid,uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pos_checkout_transition(uuid,text,uuid,text,uuid,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_checkout_claim(uuid,text,uuid,uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pos_checkout_transition(uuid,text,uuid,text,uuid,uuid,jsonb) TO service_role;

-- Trusted server-calculated patches only. The caller supplies a previously
-- authorized admission token, not an arbitrary cashier identity or browser price.
-- Existing-order payment, register receipt capture and order update commit together.
CREATE FUNCTION public.pos_checkout_commit_order(
  p_site_id uuid, p_mutation_id text, p_owner_token uuid, p_order_id uuid,
  p_sale_patch jsonb, p_order_patch jsonb, p_expected_sale jsonb, p_expected_order jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE attempt public.pos_checkout_attempts%ROWTYPE; saved_order public.sale_orders%ROWTYPE;
  saved_sale public.sales%ROWTYPE; next_sale public.sales%ROWTYPE; next_order public.sale_orders%ROWTYPE;
  previous_claims text; previous_role text;
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
  IF p_expected_sale IS NULL OR p_expected_order IS NULL
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
  -- Existing register/accounting/attribution triggers derive the actor from JWT.
  -- Bind that actor to server-owned admission and reauthorize inside this transaction.
  previous_claims := current_setting('request.jwt.claims',true);
  previous_role := current_setting('request.jwt.claim.role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',attempt.actor_id,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM public.pos_register_authorize(p_site_id,attempt.actor_id);
  IF public.current_user_has_site_location_restrictions(p_site_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unrestricted checkout access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.sales SET lead_id=next_sale.lead_id,buyer_user_id=next_sale.buyer_user_id,
    owner_site_id=next_sale.owner_site_id,campaign_id=next_sale.campaign_id,segment_id=next_sale.segment_id,
    company_id=next_sale.company_id,title=next_sale.title,product_name=next_sale.product_name,
    amount=next_sale.amount,amount_due=next_sale.amount_due,user_id=next_sale.user_id,
    sale_date=next_sale.sale_date,source=next_sale.source,status=next_sale.status,
    payments=next_sale.payments,payment_method=next_sale.payment_method
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
  RETURN jsonb_build_object('sale',to_jsonb(saved_sale),'order',to_jsonb(saved_order));
END;
$$;
REVOKE ALL ON FUNCTION public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_checkout_commit_order(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;

COMMIT;