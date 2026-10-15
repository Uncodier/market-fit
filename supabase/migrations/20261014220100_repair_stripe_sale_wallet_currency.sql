BEGIN;

-- This RPC cannot fetch Stripe. Its USD amount is trusted server evidence, not FX.
CREATE OR REPLACE FUNCTION public.repair_stripe_sale_wallet_currency(
  p_site_id uuid,
  p_session_id text,
  p_expected_gross numeric,
  p_expected_commission numeric,
  p_expected_currency text,
  p_usd_amount_minor bigint,
  p_evidence jsonb,
  p_apply boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effect public.stripe_sale_checkout_effects%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_billing public.billing%ROWTYPE;
  v_gross public.payments%ROWTYPE;
  v_commission public.payments%ROWTYPE;
  v_expense public.transactions%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_suffix text;
  v_gross_id text;
  v_commission_id text;
  v_count integer;
  v_rate numeric;
  v_new_gross numeric;
  v_new_commission numeric;
  v_delta numeric;
  v_audit jsonb;
  v_existing jsonb;
BEGIN
  IF p_site_id IS NULL OR p_session_id IS NULL OR p_session_id !~ '^cs_[A-Za-z0-9_]+$'
    OR p_expected_currency IS NULL OR p_expected_currency !~ '^[A-Z]{3}$'
    OR p_expected_currency = 'USD'
    OR p_expected_gross IS NULL OR p_expected_gross <= 0
    OR p_expected_gross::text !~ '^[0-9]+(\.[0-9]+)?$'
    OR round(p_expected_gross, 2) <> p_expected_gross
    OR p_expected_commission IS NULL OR p_expected_commission < 0
    OR p_expected_commission::text !~ '^[0-9]+(\.[0-9]+)?$'
    OR round(p_expected_commission, 2) <> p_expected_commission
    OR p_usd_amount_minor IS NULL OR p_usd_amount_minor <= 0
    OR p_usd_amount_minor > 9007199254740991 OR p_apply IS NULL
    OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid wallet currency repair input';
  END IF;

  -- Keep the same lock order as financial settlement: effect, sale, site, billing,
  -- payments. Expense sources follow payments; no journal is posted here.
  SELECT * INTO STRICT v_effect FROM public.stripe_sale_checkout_effects
    WHERE stripe_session_id = p_session_id FOR UPDATE;
  IF v_effect.settlement_status IS DISTINCT FROM 'settled'
    OR v_effect.financial_status IS DISTINCT FROM 'completed'
    OR v_effect.compensation_status IS DISTINCT FROM 'not_required'
    OR v_effect.stripe_refund_id IS NOT NULL OR v_effect.sale_id IS NULL THEN
    RAISE EXCEPTION 'Stripe effect is not eligible for wallet currency repair';
  END IF;
  SELECT * INTO STRICT v_sale FROM public.sales
    WHERE id = v_effect.sale_id FOR UPDATE;
  IF v_sale.site_id IS DISTINCT FROM p_site_id
    OR v_sale.stripe_checkout_session_id IS DISTINCT FROM p_session_id
    OR v_sale.stripe_payment_intent_id IS DISTINCT FROM v_effect.payment_intent_id
    OR v_effect.sale_reference IS DISTINCT FROM v_sale.id::text
    OR v_sale.amount_due IS DISTINCT FROM 0::numeric
    OR v_sale.status IS NULL OR v_sale.status IN ('refunded', 'cancelled')
    OR upper(v_sale.currency) IS DISTINCT FROM upper(v_effect.currency)
    OR EXISTS (SELECT 1 FROM public.accounting_sale_refunds WHERE sale_id = v_sale.id) THEN
    RAISE EXCEPTION 'Sale is mismatched, refunded, or not eligible';
  END IF;
  IF coalesce(p_evidence->>'source', '') NOT IN ('resolveStripeSaleWalletAmount', 'verified_operator_usd')
    OR (p_evidence->>'source' = 'verified_operator_usd' AND (
      p_evidence->'ack_manual_usd' IS DISTINCT FROM 'true'::jsonb
      OR coalesce(p_evidence->>'evidence_reference', '') !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$'
    ))
    OR p_evidence->>'session_id' IS DISTINCT FROM p_session_id
    OR p_evidence->>'sale_id' IS DISTINCT FROM v_sale.id::text
    OR p_evidence->>'site_id' IS DISTINCT FROM p_site_id::text
    OR v_effect.payment_intent_id IS NULL
    OR p_evidence->>'payment_intent_id' IS DISTINCT FROM v_effect.payment_intent_id
    OR p_evidence->>'checkout_currency' IS DISTINCT FROM lower(v_effect.currency)
    OR (p_evidence->>'checkout_amount_minor')::numeric IS DISTINCT FROM v_effect.amount_minor::numeric
    OR (p_evidence->>'usd_amount_minor')::numeric IS DISTINCT FROM p_usd_amount_minor::numeric
    OR coalesce(p_evidence->>'project', '') !~ '^[a-z0-9]{20}$'
    OR coalesce(p_evidence->>'mode', '') NOT IN ('test', 'live')
    OR nullif(p_evidence->>'captured_at', '') IS NULL THEN
    RAISE EXCEPTION 'Stripe wallet amount evidence does not match the stored checkout';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('stripe-billing:' || p_site_id::text, 0));
  SELECT * INTO STRICT v_billing FROM public.billing
    WHERE site_id = p_site_id FOR UPDATE;
  IF v_billing.account_balance IS NULL
    OR v_billing.account_balance::text !~ '^[0-9]+(\.[0-9]+)?$' THEN
    RAISE EXCEPTION 'Missing or invalid wallet balance';
  END IF;
  v_suffix := coalesce(v_effect.order_id::text, p_session_id);
  v_gross_id := 'sale_' || v_sale.id::text || '_' || v_suffix;
  v_commission_id := 'commission_' || v_sale.id::text || '_' || v_suffix;
  v_count := 0;
  FOR v_payment IN
    SELECT * FROM public.payments
    WHERE transaction_id IN (v_gross_id, v_commission_id)
      OR (site_id = p_site_id AND transaction_type IN ('sale', 'commission') AND (
        details->>'sale_id' = v_sale.id::text OR details->>'stripe_session_id' = p_session_id
        OR details->>'related_transaction_id' = v_gross_id
      ))
    ORDER BY transaction_id, id FOR UPDATE
  LOOP
    v_count := v_count + 1;
    IF v_payment.transaction_id = v_gross_id THEN v_gross := v_payment;
    ELSIF v_payment.transaction_id = v_commission_id THEN v_commission := v_payment;
    ELSE RAISE EXCEPTION 'Ambiguous sale payment ledger rows';
    END IF;
  END LOOP;
  IF v_count <> 2 OR v_gross.id IS NULL OR v_commission.id IS NULL THEN
    RAISE EXCEPTION 'Missing or duplicate sale payment ledger rows';
  END IF;
  IF v_gross.site_id IS DISTINCT FROM p_site_id OR v_commission.site_id IS DISTINCT FROM p_site_id
    OR v_gross.transaction_type IS DISTINCT FROM 'sale'
    OR v_commission.transaction_type IS DISTINCT FROM 'commission'
    OR v_gross.status IS DISTINCT FROM 'completed' OR v_commission.status IS DISTINCT FROM 'completed'
    OR v_gross.payment_method IS DISTINCT FROM 'stripe'
    OR v_commission.payment_method IS DISTINCT FROM 'system'
    OR v_gross.details->>'sale_id' IS DISTINCT FROM v_sale.id::text
    OR v_commission.details->>'sale_id' IS DISTINCT FROM v_sale.id::text
    OR v_gross.details->>'order_id' IS DISTINCT FROM v_effect.order_id::text
    OR v_commission.details->>'order_id' IS DISTINCT FROM v_effect.order_id::text
    OR v_gross.details->>'stripe_session_id' IS DISTINCT FROM p_session_id
    OR v_gross.details->>'stripe_payment_intent_id' IS DISTINCT FROM v_effect.payment_intent_id
    OR v_commission.details->>'related_transaction_id' IS DISTINCT FROM v_gross_id THEN
    RAISE EXCEPTION 'Sale payment ledger identity is inconsistent';
  END IF;
  v_rate := (v_gross.details->>'commission_rate')::numeric;
  IF v_rate IS NULL OR v_rate <= 0 OR v_rate >= 1
    OR v_rate::text !~ '^[0-9]+(\.[0-9]+)?$'
    OR (v_commission.details->>'commission_rate')::numeric IS DISTINCT FROM v_rate
    OR round(p_expected_gross * v_rate, 2) <> p_expected_commission THEN
    RAISE EXCEPTION 'Stored commission rate is missing or inconsistent';
  END IF;
  v_new_gross := p_usd_amount_minor::numeric / 100;
  v_new_commission := round(v_new_gross * v_rate, 2);
  IF v_new_gross - v_new_commission <= 0 THEN
    RAISE EXCEPTION 'Repaired wallet credit must be positive';
  END IF;

  -- Find all description matches first, not only amount matches: a second row
  -- with a changed amount is ambiguity/manual intervention, not safe to ignore.
  v_count := 0;
  FOR v_expense IN SELECT * FROM public.transactions
    WHERE site_id = p_site_id AND (
      description = 'Platform commission for sale ' || v_sale.id::text
      OR (v_effect.order_id IS NOT NULL
        AND description = 'Platform commission for order ' || v_effect.order_id::text)
    ) ORDER BY id FOR UPDATE
  LOOP
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Missing or ambiguous platform commission expense'; END IF;
  IF v_expense.type IS DISTINCT FROM 'variable' OR v_expense.category IS DISTINCT FROM 'operating' THEN
    RAISE EXCEPTION 'Platform commission expense classification is inconsistent';
  END IF;

  v_existing := v_gross.details->'fx_repair';
  IF v_gross.details ? 'fx_repair' OR v_commission.details ? 'fx_repair' THEN
    IF jsonb_typeof(v_existing) IS DISTINCT FROM 'object'
      OR v_existing IS DISTINCT FROM v_commission.details->'fx_repair'
      OR v_existing->>'version' IS DISTINCT FROM '1'
      OR v_existing->>'site_id' IS DISTINCT FROM p_site_id::text
      OR v_existing->>'session_id' IS DISTINCT FROM p_session_id
      OR (v_existing->>'usd_amount_minor')::numeric IS DISTINCT FROM p_usd_amount_minor::numeric
      OR (v_existing->'original'->'gross'->>'amount')::numeric IS DISTINCT FROM p_expected_gross
      OR (v_existing->'original'->'commission'->>'amount')::numeric IS DISTINCT FROM p_expected_commission
      OR v_existing->'original'->'gross'->>'currency' IS DISTINCT FROM p_expected_currency
      OR v_existing->'original'->'commission'->>'currency' IS DISTINCT FROM p_expected_currency
      OR v_gross.currency IS DISTINCT FROM 'USD' OR v_commission.currency IS DISTINCT FROM 'USD'
      OR v_gross.amount IS DISTINCT FROM v_new_gross
      OR (v_gross.details->>'gross_amount')::numeric IS DISTINCT FROM v_new_gross
      OR v_commission.amount IS DISTINCT FROM v_new_commission
      OR v_expense.id::text IS DISTINCT FROM v_existing->'original'->'expense'->>'id'
      OR v_expense.amount IS DISTINCT FROM v_new_commission OR v_expense.currency IS DISTINCT FROM 'USD' THEN
      RAISE EXCEPTION 'Existing FX repair audit or repaired values are inconsistent';
    END IF;
    RETURN jsonb_build_object('status', 'already_repaired', 'audit', v_existing);
  END IF;

  IF v_gross.amount IS DISTINCT FROM p_expected_gross
    OR v_commission.amount IS DISTINCT FROM p_expected_commission
    OR v_gross.currency IS DISTINCT FROM p_expected_currency
    OR v_commission.currency IS DISTINCT FROM p_expected_currency
    OR upper(v_effect.currency) IS DISTINCT FROM p_expected_currency
    OR (v_gross.details->>'gross_amount')::numeric IS DISTINCT FROM p_expected_gross
    OR (v_gross.details->>'original_amount')::numeric IS DISTINCT FROM v_effect.amount_minor::numeric
    OR lower(v_gross.details->>'original_currency') IS DISTINCT FROM lower(v_effect.currency)
    OR v_expense.amount IS DISTINCT FROM p_expected_commission
    OR v_expense.currency IS DISTINCT FROM p_expected_currency THEN
    RAISE EXCEPTION 'Expected original amounts/currency do not match; manual correction requires review';
  END IF;
  v_delta := (v_new_gross - v_new_commission) - (p_expected_gross - p_expected_commission);
  IF v_billing.account_balance + v_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance for differential currency repair';
  END IF;
  v_audit := jsonb_build_object(
    'version', 1, 'site_id', p_site_id, 'session_id', p_session_id,
    'usd_amount_minor', p_usd_amount_minor, 'commission_rate', v_rate,
    'balance_delta', v_delta, 'balance_before', v_billing.account_balance,
    'balance_after', v_billing.account_balance + v_delta,
    'original', jsonb_build_object('gross', to_jsonb(v_gross),
      'commission', to_jsonb(v_commission), 'expense', to_jsonb(v_expense)),
    'evidence', p_evidence, 'repaired_at', clock_timestamp()
  );
  IF NOT p_apply THEN
    RETURN jsonb_build_object('status', 'preview', 'new_gross', v_new_gross,
      'new_commission', v_new_commission, 'audit', v_audit);
  END IF;

  -- Differential adjustment only: purchased/monthly/manual credits survive.
  UPDATE public.billing SET account_balance = account_balance + v_delta,
    updated_at = clock_timestamp() WHERE id = v_billing.id;
  UPDATE public.payments SET amount = v_new_gross, currency = 'USD',
    details = details || jsonb_build_object('gross_amount', v_new_gross, 'fx_repair', v_audit),
    updated_at = clock_timestamp() WHERE id = v_gross.id;
  UPDATE public.payments SET amount = v_new_commission, currency = 'USD',
    details = details || jsonb_build_object('fx_repair', v_audit),
    updated_at = clock_timestamp() WHERE id = v_commission.id;
  UPDATE public.transactions SET amount = v_new_commission, currency = 'USD',
    accounting_state = CASE WHEN accounting_state = 'unpublished' THEN 'unpublished' ELSE 'pending' END,
    updated_at = clock_timestamp() WHERE id = v_expense.id;
  RETURN jsonb_build_object('status', 'repaired', 'new_gross', v_new_gross,
    'new_commission', v_new_commission, 'audit', v_audit);
END;
$$;

REVOKE ALL ON FUNCTION public.repair_stripe_sale_wallet_currency(
  uuid, text, numeric, numeric, text, bigint, jsonb, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_stripe_sale_wallet_currency(
  uuid, text, numeric, numeric, text, bigint, jsonb, boolean
) TO service_role;

COMMIT;