BEGIN;

-- Forward-only guard: never credit local currency into the USD wallet.
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
  -- account_balance is denominated in USD, regardless of checkout currency.
  IF upper(trim(coalesce(p_settlement_currency, ''))) <> 'USD' THEN
    RAISE EXCEPTION 'Stripe wallet settlement must be USD';
  END IF;
  IF p_settlement_amount IS NULL OR p_settlement_amount <= 0
    OR p_settlement_amount::text IN ('NaN', 'Infinity', '-Infinity')
    OR p_settlement_amount <> round(p_settlement_amount, 2) THEN
    RAISE EXCEPTION 'Invalid Stripe USD settlement amount';
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
    IF EXISTS (
      SELECT 1 FROM public.payments
      WHERE transaction_id = v_sale_transaction_id
        AND (upper(currency) IS DISTINCT FROM 'USD' OR amount <> p_settlement_amount)
    ) THEN
      RAISE EXCEPTION 'Existing Stripe revenue requires currency reconciliation';
    END IF;
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
    'USD',
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
    'USD',
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
      'USD',
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

REVOKE ALL ON FUNCTION public.apply_stripe_sale_financial_effects(uuid, text, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_sale_financial_effects(uuid, text, numeric, text)
  TO service_role;

COMMIT;
