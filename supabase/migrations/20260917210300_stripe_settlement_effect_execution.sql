BEGIN;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS shipments_stripe_checkout_session_id_uidx
  ON public.shipments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_id_uidx
  ON public.payments (transaction_id)
  WHERE transaction_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.billing
    GROUP BY site_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce billing site uniqueness while duplicate sites exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS billing_site_id_uidx
  ON public.billing (site_id);

CREATE OR REPLACE FUNCTION public.apply_stripe_sale_financial_effects(
  p_sale_id uuid,
  p_session_id text,
  p_settlement_amount numeric,
  p_settlement_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect public.stripe_sale_checkout_effects%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_billing_id uuid;
  v_plan text;
  v_site_user_id uuid;
  v_commission_rate numeric;
  v_commission_amount numeric;
  v_balance_credit numeric;
  v_suffix text;
  v_sale_transaction_id text;
  v_commission_transaction_id text;
BEGIN
  IF p_settlement_amount IS NULL OR p_settlement_amount <= 0
    OR nullif(trim(p_settlement_currency), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid Stripe settlement amount';
  END IF;

  SELECT * INTO v_effect
  FROM public.stripe_sale_checkout_effects
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_effect.settlement_status <> 'settled'
    OR v_effect.sale_id IS DISTINCT FROM p_sale_id THEN
    RAISE EXCEPTION 'Stripe settlement effect is not eligible';
  END IF;
  IF v_effect.financial_status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_sale.stripe_checkout_session_id IS DISTINCT FROM p_session_id
    OR coalesce(v_sale.amount_due, 0) <> 0
    OR v_sale.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Stripe sale is not eligible for financial effects';
  END IF;

  v_suffix := coalesce(v_effect.order_id::text, p_session_id);
  v_sale_transaction_id := 'sale_' || p_sale_id::text || '_' || v_suffix;
  v_commission_transaction_id :=
    'commission_' || p_sale_id::text || '_' || v_suffix;

  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE transaction_id = v_sale_transaction_id
  ) THEN
    UPDATE public.stripe_sale_checkout_effects
    SET financial_status = 'completed',
        financial_completed_at = now(),
        updated_at = now()
    WHERE stripe_session_id = p_session_id;
    RETURN jsonb_build_object('status', 'recovered_existing');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('stripe-billing:' || v_sale.site_id::text, 0)
  );
  SELECT id, plan
  INTO v_billing_id, v_plan
  FROM public.billing
  WHERE site_id = v_sale.site_id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  v_plan := coalesce(v_plan, 'foundry');
  v_commission_rate := CASE
    WHEN v_plan = 'enterprise' THEN 0.02
    WHEN v_plan = 'engine' THEN 0.03
    ELSE 0.05
  END;
  v_commission_amount :=
    round(p_settlement_amount * v_commission_rate, 2);
  v_balance_credit :=
    round(p_settlement_amount - v_commission_amount, 2);

  IF v_balance_credit <= 0 THEN
    RAISE EXCEPTION 'Stripe settlement balance credit is not positive';
  END IF;

  IF v_billing_id IS NULL THEN
    INSERT INTO public.billing AS current_billing (site_id, account_balance)
    VALUES (v_sale.site_id, v_balance_credit)
    ON CONFLICT (site_id) DO UPDATE
    SET account_balance =
          coalesce(current_billing.account_balance, 0)
          + excluded.account_balance,
        updated_at = now();
  ELSE
    UPDATE public.billing
    SET account_balance = coalesce(account_balance, 0) + v_balance_credit,
        updated_at = now()
    WHERE id = v_billing_id;
  END IF;

  INSERT INTO public.payments (
    site_id, transaction_id, transaction_type, amount, currency,
    status, payment_method, details
  )
  VALUES
  (
    v_sale.site_id,
    v_sale_transaction_id,
    'sale',
    p_settlement_amount,
    upper(p_settlement_currency),
    'completed',
    'stripe',
    jsonb_build_object(
      'stripe_payment_intent_id', v_effect.payment_intent_id,
      'stripe_session_id', p_session_id,
      'order_id', v_effect.order_id,
      'sale_id', p_sale_id,
      'gross_amount', p_settlement_amount,
      'original_currency', v_effect.currency,
      'original_amount', v_effect.amount_minor,
      'commission_rate', v_commission_rate
    )
  ),
  (
    v_sale.site_id,
    v_commission_transaction_id,
    'commission',
    v_commission_amount,
    upper(p_settlement_currency),
    'completed',
    'system',
    jsonb_build_object(
      'order_id', v_effect.order_id,
      'sale_id', p_sale_id,
      'commission_rate', v_commission_rate,
      'related_transaction_id', v_sale_transaction_id
    )
  );

  SELECT user_id INTO v_site_user_id
  FROM public.sites
  WHERE id = v_sale.site_id;

  IF v_site_user_id IS NOT NULL THEN
    INSERT INTO public.transactions (
      site_id, user_id, type, amount, description, category,
      date, currency, accounting_state
    )
    VALUES (
      v_sale.site_id,
      v_site_user_id,
      'variable',
      v_commission_amount,
      CASE
        WHEN v_effect.order_id IS NULL
          THEN 'Platform commission for sale ' || p_sale_id::text
        ELSE 'Platform commission for order ' || v_effect.order_id::text
      END,
      'operating',
      current_date,
      upper(p_settlement_currency),
      'pending'
    );
  END IF;

  UPDATE public.stripe_sale_checkout_effects
  SET financial_status = 'completed',
      financial_completed_at = now(),
      updated_at = now()
  WHERE stripe_session_id = p_session_id;

  RETURN jsonb_build_object(
    'status', 'completed',
    'balance_credit', v_balance_credit,
    'commission_amount', v_commission_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_stripe_sale_fulfillment(
  p_sale_id uuid,
  p_session_id text,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect public.stripe_sale_checkout_effects%ROWTYPE;
  v_sale_status text;
  v_order_status text;
BEGIN
  SELECT * INTO v_effect
  FROM public.stripe_sale_checkout_effects
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_effect.settlement_status <> 'settled'
    OR v_effect.sale_id IS DISTINCT FROM p_sale_id THEN
    RAISE EXCEPTION 'Stripe fulfillment effect is not eligible';
  END IF;
  IF v_effect.fulfillment_status = 'not_required'
    OR v_effect.fulfillment_status = 'completed' THEN
    RETURN jsonb_build_object('status', v_effect.fulfillment_status);
  END IF;
  SELECT status INTO v_sale_status
  FROM public.sales
  WHERE id = p_sale_id
    AND stripe_checkout_session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND OR v_sale_status IN ('cancelled', 'refunded') THEN
    UPDATE public.stripe_sale_checkout_effects
    SET fulfillment_status = 'not_required',
        updated_at = now()
    WHERE stripe_session_id = p_session_id;
    RETURN jsonb_build_object('status', 'not_required');
  END IF;

  IF v_effect.order_id IS NOT NULL THEN
    SELECT status INTO v_order_status
    FROM public.sale_orders
    WHERE id = v_effect.order_id
      AND sale_id = p_sale_id
    FOR UPDATE;
    IF NOT FOUND OR v_order_status IN ('cancelled', 'refunded') THEN
      UPDATE public.stripe_sale_checkout_effects
      SET fulfillment_status = 'not_required',
          updated_at = now()
      WHERE stripe_session_id = p_session_id;
      RETURN jsonb_build_object('status', 'not_required');
    END IF;
  END IF;

  IF v_effect.fulfillment_status = 'processing'
    AND v_effect.fulfillment_claimed_at > now() - interval '10 minutes' THEN
    RETURN jsonb_build_object('status', 'in_progress');
  END IF;

  UPDATE public.stripe_sale_checkout_effects
  SET fulfillment_status = 'processing',
      fulfillment_claim_token = p_claim_token,
      fulfillment_claimed_at = now(),
      updated_at = now()
  WHERE stripe_session_id = p_session_id;
  RETURN jsonb_build_object(
    'status', 'claimed',
    'claim_token', p_claim_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stripe_sale_fulfillment(
  p_session_id text,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stripe_sale_checkout_effects
  SET fulfillment_status = 'completed',
      fulfillment_claim_token = NULL,
      fulfillment_completed_at = now(),
      updated_at = now()
  WHERE stripe_session_id = p_session_id
    AND fulfillment_status = 'processing'
    AND fulfillment_claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_stripe_sale_fulfillment(
  p_session_id text,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.stripe_sale_checkout_effects
  SET fulfillment_status = 'failed',
      fulfillment_claim_token = NULL,
      updated_at = now()
  WHERE stripe_session_id = p_session_id
    AND fulfillment_status = 'processing'
    AND fulfillment_claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stripe_sale_inventory_effect(
  p_sale_id uuid,
  p_order_id uuid,
  p_session_id text,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect public.stripe_sale_checkout_effects%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_order public.sale_orders%ROWTYPE;
  v_commerce jsonb;
  v_policy text;
  v_item record;
BEGIN
  SELECT * INTO v_effect
  FROM public.stripe_sale_checkout_effects
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_effect.sale_id IS DISTINCT FROM p_sale_id
    OR v_effect.order_id IS DISTINCT FROM p_order_id
    OR v_effect.fulfillment_status <> 'processing'
    OR v_effect.fulfillment_claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'Stripe inventory effect is not owned by this claim';
  END IF;
  IF v_effect.inventory_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_completed');
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
    AND stripe_checkout_session_id = p_session_id
  FOR UPDATE;
  SELECT * INTO v_order
  FROM public.sale_orders
  WHERE id = p_order_id
    AND sale_id = p_sale_id
  FOR UPDATE;
  IF v_sale.id IS NULL OR v_order.id IS NULL THEN
    RAISE EXCEPTION 'Stripe inventory sale or order was not found';
  END IF;

  SELECT commerce INTO v_commerce
  FROM public.settings
  WHERE site_id = v_sale.site_id
  LIMIT 1;
  v_policy := coalesce(v_commerce->>'decrement_stock_on', 'ship');

  IF v_policy <> 'never' AND v_order.origin_location_id IS NOT NULL THEN
    FOR v_item IN
      SELECT soi.catalog_item_id, soi.quantity
      FROM public.sale_order_items soi
      JOIN public.catalog_items ci ON ci.id = soi.catalog_item_id
      WHERE soi.sale_order_id = p_order_id
        AND soi.catalog_item_id IS NOT NULL
        AND ci.track_inventory = true
    LOOP
      INSERT INTO public.inventory_levels AS current_level (
        site_id, catalog_item_id, location_id, quantity, updated_at
      )
      VALUES (
        v_sale.site_id,
        v_item.catalog_item_id,
        v_order.origin_location_id,
        0,
        now()
      )
      ON CONFLICT (catalog_item_id, location_id)
      DO UPDATE SET
        quantity = greatest(
          0,
          current_level.quantity - v_item.quantity
        ),
        updated_at = now();
    END LOOP;
  END IF;

  UPDATE public.stripe_sale_checkout_effects
  SET inventory_completed_at = now(),
      updated_at = now()
  WHERE stripe_session_id = p_session_id;
  RETURN jsonb_build_object('status', 'completed');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_sale_financial_effects(
  uuid, text, numeric, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_stripe_sale_fulfillment(
  uuid, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_sale_fulfillment(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_stripe_sale_fulfillment(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_stripe_sale_inventory_effect(
  uuid, uuid, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_sale_financial_effects(
  uuid, text, numeric, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_stripe_sale_fulfillment(
  uuid, text, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_stripe_sale_fulfillment(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stripe_sale_fulfillment(text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_sale_inventory_effect(
  uuid, uuid, text, uuid
) TO service_role;

COMMIT;
