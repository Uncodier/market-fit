BEGIN;
SET LOCAL lock_timeout = '5s';

-- Requires the coordinated API credit buckets, annual coverage, cancellation
-- chronology and one-credit add-on window migrations. Never downgrade to the
-- historical additive settlement implementation when prerequisites are absent.
DO $$
BEGIN
  IF to_regprocedure('public.sync_stripe_subscription_state(uuid,text,text,text,text,timestamptz,timestamptz,timestamptz,boolean,text)') IS NULL
    OR to_regprocedure('public.apply_paid_subscription_credit_coverage(jsonb)') IS NULL
    OR to_regprocedure('public.renew_site_plan_credits(uuid)') IS NULL
    OR to_regclass('public.site_retired_stripe_subscriptions') IS NULL THEN
    RAISE EXCEPTION 'Free add-ons require coordinated annual credit coverage prerequisites';
  END IF;
  IF position('previous paid window/usage' IN pg_get_functiondef('public.renew_site_plan_credits(uuid)'::regprocedure)) = 0
    OR position('stored excess' IN pg_get_functiondef('public.apply_paid_subscription_credit_coverage(jsonb)'::regprocedure)) = 0
    OR public.site_plan_credit_allowance('engine',2) <> 22 THEN
    RAISE EXCEPTION 'Free add-ons require cancellation chronology and one-credit add-on window corrections';
  END IF;
END;
$$;

-- Only paid add-on service can establish Free Stripe coverage. No balance,
-- payment, historical proof or already-consumed window is backfilled.
ALTER TABLE public.billing DROP CONSTRAINT billing_paid_subscription_coverage_valid;
ALTER TABLE public.billing ADD CONSTRAINT billing_paid_subscription_coverage_valid CHECK (
  (paid_subscription_period_start IS NULL AND paid_subscription_period_end IS NULL
    AND paid_subscription_invoice_id IS NULL AND paid_subscription_plan IS NULL
    AND paid_subscription_addons_count IS NULL AND paid_subscription_paid_at IS NULL)
  OR (paid_subscription_period_start IS NOT NULL AND paid_subscription_period_end IS NOT NULL
    AND isfinite(paid_subscription_period_start) AND isfinite(paid_subscription_period_end)
    AND paid_subscription_period_end > paid_subscription_period_start
    AND paid_subscription_invoice_id IS NOT NULL AND paid_subscription_invoice_id ~ '^in_[A-Za-z0-9]+$'
    AND paid_subscription_paid_at IS NOT NULL AND isfinite(paid_subscription_paid_at)
    AND paid_subscription_plan IS NOT NULL AND paid_subscription_plan IN ('commission','engine','foundry','enterprise')
    AND paid_subscription_addons_count IS NOT NULL AND paid_subscription_addons_count BETWEEN 0 AND 100
    AND (paid_subscription_plan <> 'commission' OR paid_subscription_addons_count > 0)
    AND stripe_subscription_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.site_plan_credit_allowance(p_plan text, p_addons integer DEFAULT 0)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  RETURN CASE lower(trim(p_plan))
    WHEN 'engine' THEN 20 WHEN 'starter' THEN 20
    WHEN 'foundry' THEN 100 WHEN 'startup' THEN 100
    WHEN 'enterprise' THEN 500
    WHEN 'commission' THEN 1 WHEN 'free' THEN 1 WHEN 'toolbox' THEN 1
    ELSE 0 END
    + CASE WHEN lower(trim(p_plan)) IN ('commission','engine','starter','foundry','startup','enterprise')
      THEN greatest(coalesce(p_addons, 0), 0) ELSE 0 END;
END;
$$;

-- Initial Free add-ons retain the existing monthly Free usage; subsequent paid
-- updates/renewals keep the same protected-bucket and chronology invariants.
CREATE OR REPLACE FUNCTION public.apply_paid_subscription_credit_coverage(p_invoice jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  b public.billing%ROWTYPE; w record; r jsonb;
  v_site uuid := (p_invoice->>'site_id')::uuid;
  v_interval text := coalesce(p_invoice->>'billing_interval','month');
  v_start timestamptz := (p_invoice->>'period_start')::timestamptz;
  v_end timestamptz := (p_invoice->>'period_end')::timestamptz;
  v_allowance numeric := public.site_plan_credit_allowance(p_invoice->>'plan',(p_invoice->>'addons_count')::integer);
  v_source text := 'stripe_invoice:' || (p_invoice->>'invoice_id');
  v_anchor timestamptz;
  v_remaining numeric; v_delta numeric;
BEGIN
  IF v_interval NOT IN ('month','year') OR v_start IS NULL OR v_end IS NULL
    OR NOT isfinite(v_start) OR NOT isfinite(v_end) OR v_start > now() OR v_end <= now()
    OR (p_invoice->>'billing_reason' = 'subscription_update'
      AND coalesce((p_invoice->>'coverage_verified')::boolean,false) IS NOT TRUE)
  THEN RAISE EXCEPTION 'Invalid verified paid coverage'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id = v_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice site has no billing record'; END IF;
  IF b.paid_subscription_period_start > v_start
    OR b.paid_subscription_paid_at > (p_invoice->>'paid_at')::timestamptz THEN
    RETURN jsonb_build_object('success',true,'outcome','stale_period','credits_granted',0);
  END IF;
  IF b.paid_subscription_period_start = v_start AND b.paid_subscription_period_end >= v_end
    AND p_invoice->>'billing_reason' <> 'subscription_update' THEN
    RETURN jsonb_build_object('success',true,'outcome','not_due','credits_granted',0);
  END IF;
  -- Bind identity first: the replacement guard intentionally clears prior coverage.
  UPDATE public.billing SET stripe_subscription_id = p_invoice->>'subscription_id' WHERE id = b.id;
  v_anchor := coalesce(b.plan_credit_anchor,CASE WHEN p_invoice->>'billing_reason' = 'subscription_update'
    THEN b.plan_credit_period_start END,CASE WHEN p_invoice->>'plan' = 'commission'
      AND b.plan_credit_period_end > now() THEN b.plan_credit_period_start END,v_start);
  IF v_interval = 'year' THEN
    SELECT * INTO w FROM public.subscription_monthly_credit_window(v_anchor,v_end,now());
  ELSE
    SELECT v_start AS period_start,v_end AS period_end INTO w;
  END IF;
  IF b.plan_credit_period_end > now() AND ((b.plan_credit_anchor IS NOT NULL
      AND (v_interval = 'year' OR p_invoice->>'billing_reason' = 'subscription_update'
        OR b.paid_subscription_invoice_id IS NULL))
    OR (p_invoice->>'plan' = 'commission' AND b.plan_credit_anchor IS NULL)
    OR (p_invoice->>'billing_reason' = 'subscription_update'
      AND b.plan_credit_source LIKE 'stripe%' AND b.plan_credit_source <> 'stripe_unverified')) THEN
    IF b.paid_subscription_invoice_id IS NOT NULL AND b.paid_subscription_plan IS NOT NULL
      AND b.stripe_subscription_id = p_invoice->>'subscription_id' THEN
      -- Carry only the stored excess, not the previous full quota or remaining
      -- balance. Repeated changes retain this same excess and never refill usage.
      v_allowance := v_allowance + greatest(b.plan_credit_allowance -
        public.site_plan_credit_allowance(b.paid_subscription_plan,b.paid_subscription_addons_count),0);
    END IF;
    v_remaining := greatest(v_allowance-b.plan_credits_used,0);
    v_delta := v_remaining-b.plan_credits_available;
    UPDATE public.billing SET plan_credits_available = v_remaining,
      credits_available = v_remaining+purchased_credits_available+legacy_credits_available,
      plan_credit_allowance = v_allowance,
      plan_credit_period_start = b.plan_credit_period_start,
      plan_credit_period_end = greatest(b.plan_credit_period_end,w.period_end),
      plan_credit_source = v_source WHERE id = b.id;
    INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
      VALUES(v_site,v_delta,'plan_credit_adjustment','Paid plan change retaining current usage',
        jsonb_build_object('credit_bucket','plan','source',v_source,'plan_credits_used',b.plan_credits_used));
    -- payments.credits records integer reset grants; the adjustment stays in the ledger.
    r := jsonb_build_object('success',true,'outcome','adjusted','credits_granted',0);
  ELSE
    r := public.reset_site_plan_credit_period(v_site,w.period_start,w.period_end,v_allowance,v_source);
  END IF;
  IF r->>'outcome' <> 'stale_period' THEN
    UPDATE public.billing SET plan = p_invoice->>'plan',addons_count = (p_invoice->>'addons_count')::integer,
      billing_interval = v_interval,paid_subscription_period_start = v_start,paid_subscription_period_end = v_end,
      paid_subscription_invoice_id = p_invoice->>'invoice_id',paid_subscription_plan = p_invoice->>'plan',
      paid_subscription_paid_at = (p_invoice->>'paid_at')::timestamptz,
      plan_credit_anchor = v_anchor,
      paid_subscription_addons_count = (p_invoice->>'addons_count')::integer WHERE id = b.id;
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_stripe_subscription_invoice(p_invoice jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_site uuid := (p_invoice->>'site_id')::uuid;
  v_invoice text := p_invoice->>'invoice_id';
  v_customer text := p_invoice->>'customer_id';
  v_subscription text := p_invoice->>'subscription_id';
  v_status text := p_invoice->>'status';
  v_amount numeric := (p_invoice->>'amount')::numeric;
  v_currency text := p_invoice->>'currency';
  v_plan text := p_invoice->>'plan';
  v_addons integer := (p_invoice->>'addons_count')::integer;
  v_reason text := p_invoice->>'billing_reason';
  v_interval text := coalesce(p_invoice->>'billing_interval','month');
  v_current_status text := lower(nullif(p_invoice->>'current_subscription_status', ''));
  v_period_start timestamptz := nullif(p_invoice->>'period_start', '')::timestamptz;
  v_period_end timestamptz := nullif(p_invoice->>'period_end', '')::timestamptz;
  v_paid_at timestamptz := nullif(p_invoice->>'paid_at', '')::timestamptz;
  v_credits integer := 0;
  v_reset jsonb;
  v_credit_outcome text := 'not_eligible';
  v_billing public.billing%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_settlement public.stripe_subscription_invoice_settlements%ROWTYPE;
  v_details jsonb;
  v_coverage jsonb;
  v_duplicate boolean := false;
  v_applied boolean := false;
BEGIN
  IF jsonb_typeof(p_invoice) IS DISTINCT FROM 'object'
    OR v_site IS NULL OR v_invoice IS NULL OR v_invoice !~ '^in_[A-Za-z0-9]+$'
    OR v_customer IS NULL OR v_customer !~ '^cus_[A-Za-z0-9]+$'
    OR v_subscription IS NULL OR v_subscription !~ '^sub_[A-Za-z0-9]+$'
    OR v_status IS NULL OR v_status NOT IN ('paid', 'failed')
    OR v_amount IS NULL OR v_amount < 0 OR v_amount::text IN ('NaN', 'Infinity', '-Infinity')
    OR v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$'
    OR v_plan IS NULL OR v_plan NOT IN ('commission', 'engine', 'foundry', 'enterprise')
    OR (v_plan = 'commission' AND (v_addons < 1 OR p_invoice->'coverage_verified' IS DISTINCT FROM 'true'::jsonb))
    OR v_addons IS NULL OR v_addons < 0 OR v_addons > 100
    OR v_interval NOT IN ('month','year')
    OR v_reason IS NULL
    OR (v_current_status IS NOT NULL AND v_current_status NOT IN
      ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'canceled', 'cancelled', 'incomplete_expired'))
    OR (v_status = 'paid' AND (v_paid_at IS NULL OR NOT isfinite(v_paid_at)))
    OR ((v_period_start IS NULL) <> (v_period_end IS NULL))
    OR (v_period_start IS NOT NULL AND (NOT isfinite(v_period_start)
      OR NOT isfinite(v_period_end) OR v_period_end <= v_period_start))
    OR (v_reason IN ('subscription_create', 'subscription_cycle') AND v_period_start IS NULL)
    OR (v_status = 'paid' AND v_reason IN ('subscription_create', 'subscription_cycle')
      AND v_period_start > now())
  THEN RAISE EXCEPTION 'Invalid verified Stripe invoice'; END IF;

  -- Same invoice on different sites must serialize before tenant validation.
  PERFORM pg_advisory_xact_lock(hashtextextended('stripe-invoice:' || v_invoice, 0));
  SELECT * INTO v_billing FROM public.billing WHERE site_id = v_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice site has no billing record'; END IF;
  IF v_billing.stripe_customer_id IS DISTINCT FROM v_customer
    OR (v_billing.stripe_subscription_id IS NOT NULL
      AND v_billing.stripe_subscription_id <> v_subscription)
    OR EXISTS (SELECT 1 FROM public.site_retired_stripe_subscriptions
      WHERE site_id = v_site AND subscription_id = v_subscription)
  THEN RAISE EXCEPTION 'Stripe invoice billing identity mismatch'; END IF;

  SELECT * INTO v_payment FROM public.payments
    WHERE transaction_id = 'stripe_invoice_' || v_invoice FOR UPDATE;
  IF FOUND AND (v_payment.site_id <> v_site OR v_payment.transaction_type <> 'subscription')
  THEN RAISE EXCEPTION 'Stripe invoice payment identity mismatch'; END IF;

  SELECT * INTO v_settlement FROM public.stripe_subscription_invoice_settlements
    WHERE invoice_id = v_invoice;
  IF FOUND THEN
    IF v_settlement.site_id <> v_site OR v_settlement.customer_id <> v_customer
      OR v_settlement.subscription_id <> v_subscription
      OR (v_status = 'paid' AND (v_settlement.amount <> v_amount OR v_settlement.currency <> v_currency))
    THEN RAISE EXCEPTION 'Stripe invoice settlement identity mismatch'; END IF;
  END IF;

  -- Invoice snapshots are not status updates. In particular a delayed duplicate
  -- paused snapshot cannot poison an active row, or revive a newly paused row.
  -- Status synchronization is a separate expected-subscription-ID fenced RPC.
  IF v_settlement.invoice_id IS NOT NULL THEN
    IF v_status <> 'paid' OR v_settlement.credit_coverage_applied
      OR v_settlement.verified_credit_coverage IS NULL THEN
      RETURN jsonb_build_object('outcome', CASE WHEN v_status = 'paid' THEN 'duplicate' ELSE 'ignored_failure' END,
        'payment_id', v_settlement.payment_id, 'credits_granted', 0);
    END IF;
    v_duplicate := true;
    -- Financial identity was checked above. Never replace settled coverage with
    -- retry-supplied tier, period, reason, interval or paid_at.
    v_coverage := v_settlement.verified_credit_coverage;
    v_period_end := (v_coverage->>'period_end')::timestamptz;
  ELSE
    IF v_status = 'paid' AND (v_reason IN ('subscription_create','subscription_cycle')
      OR (v_reason = 'subscription_update' AND coalesce((p_invoice->>'coverage_verified')::boolean,false))) THEN
      v_coverage := jsonb_build_object('site_id',v_site,'subscription_id',v_subscription,
        'invoice_id',v_invoice,'plan',v_plan,'addons_count',v_addons,'billing_interval',v_interval,
        'billing_reason',v_reason,'period_start',v_period_start,'period_end',v_period_end,
        'paid_at',v_paid_at,'coverage_verified',true);
    END IF;
  END IF;

  IF v_status = 'failed' AND v_payment.status IS NOT NULL AND v_payment.status <> 'failed' THEN
    RETURN jsonb_build_object('outcome', 'ignored_failure', 'payment_id', v_payment.id, 'credits_granted', 0);
  END IF;
  IF NOT v_duplicate AND v_status = 'paid' AND v_payment.status IS NOT NULL AND v_payment.status <> 'failed' THEN
    RAISE EXCEPTION 'Legacy completed invoice requires credit reconciliation';
  END IF;
  IF NOT v_duplicate AND v_status = 'paid' AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE site_id = v_site AND metadata->>'stripe_invoice_id' = v_invoice AND amount > 0
  ) THEN RAISE EXCEPTION 'Invoice already has historical credits; reconciliation required'; END IF;
  IF NOT v_duplicate AND v_status = 'paid' AND v_reason = 'subscription_create' AND EXISTS (
    SELECT 1 FROM public.payments WHERE site_id = v_site AND status = 'completed'
      AND transaction_type = 'subscription' AND details->>'stripe_subscription_id' = v_subscription
      AND details ? 'stripe_session_id'
  ) THEN RAISE EXCEPTION 'Legacy subscription checkout requires credit reconciliation'; END IF;

  IF v_status = 'paid' AND v_coverage IS NOT NULL THEN
    IF lower(coalesce(v_billing.subscription_status, '')) IN ('canceled', 'cancelled', 'incomplete_expired')
      OR v_current_status IN ('canceled','cancelled','incomplete_expired') THEN
      -- Historical payment is still auditable, but must never resurrect paid
      -- entitlement after the current subscription has terminated.
      v_credit_outcome := 'terminal_subscription';
    ELSIF lower(coalesce(v_billing.subscription_status,'')) <> 'active'
      OR (v_current_status IS NOT NULL AND v_current_status <> 'active') THEN
      v_credit_outcome := 'inactive_subscription';
    ELSIF coalesce(v_billing.status, '') <> 'active' OR EXISTS (
      SELECT 1 FROM public.sites WHERE id = v_site AND archived_at IS NOT NULL
    ) THEN
      v_credit_outcome := 'inactive';
    ELSIF v_period_end <= now() THEN
      -- Do not retry an already expired historical invoice forever. Record it
      -- without a grant rather than asking the current-period helper to reject it.
      v_credit_outcome := 'stale_period';
    ELSIF (v_coverage->>'billing_reason' = 'subscription_update' OR v_coverage->>'plan' = 'commission') AND (
      p_invoice->'coverage_verified' IS DISTINCT FROM 'true'::jsonb
      OR jsonb_typeof(p_invoice->'current_service') IS DISTINCT FROM 'object'
      OR p_invoice->'current_service'->'plan' IS DISTINCT FROM v_coverage->'plan'
      OR p_invoice->'current_service'->'addons_count' IS DISTINCT FROM v_coverage->'addons_count'
      OR p_invoice->'current_service'->'billing_interval' IS DISTINCT FROM v_coverage->'billing_interval') THEN
      -- Immutable invoice proof does not prove the currently configured service.
      -- Gate by a separate fresh server-verified tuple, never retry-supplied
      -- invoice entitlement, and never overwrite/poison the settled payload.
      v_credit_outcome := 'current_service_mismatch';
    ELSE
      v_reset := public.apply_paid_subscription_credit_coverage(v_coverage);
      IF (v_reset->>'success')::boolean IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Stripe plan credit reset failed';
      END IF;
      v_credits := (v_reset->>'credits_granted')::integer;
      v_credit_outcome := v_reset->>'outcome';
      v_applied := v_credit_outcome IN ('reset','adjusted','not_due');
    END IF;
  END IF;

  IF v_duplicate THEN
    IF v_applied THEN
      UPDATE public.stripe_subscription_invoice_settlements SET credit_coverage_applied = true,
        credits_granted = credits_granted + v_credits WHERE invoice_id = v_invoice;
      UPDATE public.payments SET credits = coalesce(credits,0) + v_credits,
        details = coalesce(details,'{}'::jsonb) || jsonb_build_object('credit_outcome',v_credit_outcome,
          'credit_coverage_recovered',true),updated_at = now() WHERE id = v_settlement.payment_id;
    END IF;
    RETURN jsonb_build_object('outcome','duplicate','payment_id',v_settlement.payment_id,
      'credits_granted',v_credits,'credit_outcome',v_credit_outcome,'coverage_recovered',v_applied);
  END IF;

  v_details := jsonb_strip_nulls(jsonb_build_object(
    'stripe_invoice_id', v_invoice, 'stripe_subscription_id', v_subscription,
    'stripe_customer_id', v_customer, 'stripe_payment_intent_id', p_invoice->>'payment_intent_id',
    'billing_reason', v_reason, 'plan', v_plan, 'addons_count', v_addons, 'billing_interval', v_interval,
    'stripe_event_id', p_invoice->>'event_id', 'paid_at', p_invoice->>'paid_at',
    'period_start', v_period_start, 'period_end', v_period_end,
    'credit_bucket', 'plan', 'credit_outcome', v_credit_outcome
  ));
  IF v_payment.id IS NULL THEN
    INSERT INTO public.payments(site_id, transaction_id, transaction_type, amount, currency,
      status, payment_method, details, credits, invoice_url)
    VALUES (v_site, 'stripe_invoice_' || v_invoice, 'subscription', v_amount, v_currency,
      CASE WHEN v_status = 'paid' THEN 'completed' ELSE 'failed' END, 'stripe', v_details,
      v_credits, p_invoice->>'invoice_url') RETURNING * INTO v_payment;
  ELSE
    UPDATE public.payments SET amount = v_amount, currency = v_currency,
      status = CASE WHEN v_status = 'paid' THEN 'completed' ELSE 'failed' END,
      details = coalesce(details, '{}'::jsonb) || v_details,
      credits = v_credits, invoice_url = coalesce(p_invoice->>'invoice_url', invoice_url), updated_at = now()
    WHERE id = v_payment.id;
  END IF;
  IF v_status = 'failed' THEN
    RETURN jsonb_build_object('outcome', 'failed_recorded', 'payment_id', v_payment.id, 'credits_granted', 0);
  END IF;

  INSERT INTO public.stripe_subscription_invoice_settlements(invoice_id, site_id, payment_id,
    customer_id, subscription_id, amount, currency, credits_granted, event_id,
    verified_credit_coverage,credit_coverage_applied)
  VALUES (v_invoice, v_site, v_payment.id, v_customer, v_subscription, v_amount, v_currency,
    v_credits, p_invoice->>'event_id',v_coverage,v_applied);
  -- The helper wrote the plan reset ledger atomically. Never also append an
  -- additive subscription grant or change purchased/legacy/account_balance.
  RETURN jsonb_build_object('outcome', 'settled', 'payment_id', v_payment.id, 'credits_granted', v_credits);
END;
$$;

REVOKE ALL ON FUNCTION public.site_plan_credit_allowance(text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_plan_credit_allowance(text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.apply_paid_subscription_credit_coverage(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_subscription_credit_coverage(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.settle_stripe_subscription_invoice(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stripe_subscription_invoice(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
