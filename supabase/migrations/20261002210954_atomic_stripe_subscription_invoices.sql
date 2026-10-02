BEGIN;
SET LOCAL lock_timeout = '5s';

-- Prevent legacy Stripe metadata or older writers from undoing the plan rename.
CREATE OR REPLACE FUNCTION public.normalize_billing_plan_names()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.plan := CASE NEW.plan WHEN 'starter' THEN 'engine'
    WHEN 'startup' THEN 'foundry' ELSE NEW.plan END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_billing_plan_names() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER normalize_billing_plan_names
  BEFORE INSERT OR UPDATE OF plan ON public.billing
  FOR EACH ROW EXECUTE FUNCTION public.normalize_billing_plan_names();
UPDATE public.billing SET plan = CASE plan WHEN 'starter' THEN 'engine'
  WHEN 'startup' THEN 'foundry' END WHERE plan IN ('starter', 'startup');

-- Invoice identity, not event identity, owns the financial side effects.
CREATE TABLE public.stripe_subscription_invoice_settlements (
  invoice_id text PRIMARY KEY CHECK (invoice_id LIKE 'in\_%'),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  customer_id text NOT NULL,
  subscription_id text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL,
  credits_granted integer NOT NULL CHECK (credits_granted >= 0),
  event_id text,
  settled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_subscription_invoice_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_subscription_invoice_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.stripe_subscription_invoice_settlements TO service_role;
CREATE INDEX stripe_subscription_invoice_settlements_site_idx
  ON public.stripe_subscription_invoice_settlements(site_id);

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
  v_credits integer := 0;
  v_billing public.billing%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_settlement public.stripe_subscription_invoice_settlements%ROWTYPE;
  v_details jsonb;
BEGIN
  IF jsonb_typeof(p_invoice) IS DISTINCT FROM 'object'
    OR v_site IS NULL OR v_invoice IS NULL OR v_invoice !~ '^in_[A-Za-z0-9]+$'
    OR v_customer IS NULL OR v_customer !~ '^cus_[A-Za-z0-9]+$'
    OR v_subscription IS NULL OR v_subscription !~ '^sub_[A-Za-z0-9]+$'
    OR v_status IS NULL OR v_status NOT IN ('paid', 'failed')
    OR v_amount IS NULL OR v_amount < 0 OR v_amount::text IN ('NaN', 'Infinity', '-Infinity')
    OR v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$'
    OR v_plan IS NULL OR v_plan NOT IN ('engine', 'foundry', 'enterprise')
    OR v_addons IS NULL OR v_addons < 0 OR v_addons > 100
    OR v_reason IS NULL
    OR (v_status = 'paid' AND nullif(p_invoice->>'paid_at', '') IS NULL)
  THEN RAISE EXCEPTION 'Invalid verified Stripe invoice'; END IF;

  -- Same invoice on different sites must serialize before tenant validation.
  PERFORM pg_advisory_xact_lock(hashtextextended('stripe-invoice:' || v_invoice, 0));
  SELECT * INTO v_billing FROM public.billing WHERE site_id = v_site FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice site has no billing record'; END IF;
  IF v_billing.stripe_customer_id IS DISTINCT FROM v_customer
    OR (v_billing.stripe_subscription_id IS NOT NULL
      AND v_billing.stripe_subscription_id <> v_subscription)
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
    RETURN jsonb_build_object('outcome', CASE WHEN v_status = 'paid' THEN 'duplicate' ELSE 'ignored_failure' END,
      'payment_id', v_settlement.payment_id, 'credits_granted', 0);
  END IF;

  IF v_status = 'failed' AND v_payment.status IS NOT NULL AND v_payment.status <> 'failed' THEN
    RETURN jsonb_build_object('outcome', 'ignored_failure', 'payment_id', v_payment.id, 'credits_granted', 0);
  END IF;
  -- Old completed rows have no trustworthy per-invoice credit marker. Never
  -- guess whether credits were delivered by an old webhook or a monthly job.
  IF v_status = 'paid' AND v_payment.status IS NOT NULL AND v_payment.status <> 'failed' THEN
    RAISE EXCEPTION 'Legacy completed invoice requires credit reconciliation';
  END IF;
  IF v_status = 'paid' AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE site_id = v_site AND metadata->>'stripe_invoice_id' = v_invoice AND amount > 0
  ) THEN RAISE EXCEPTION 'Invoice already has historical credits; reconciliation required'; END IF;
  IF v_status = 'paid' AND v_reason = 'subscription_create' AND EXISTS (
    SELECT 1 FROM public.payments WHERE site_id = v_site AND status = 'completed'
      AND transaction_type = 'subscription' AND details->>'stripe_subscription_id' = v_subscription
      AND details ? 'stripe_session_id'
  ) THEN RAISE EXCEPTION 'Legacy subscription checkout requires credit reconciliation'; END IF;

  IF v_status = 'paid' AND v_reason IN ('subscription_create', 'subscription_cycle') THEN
    v_credits := CASE v_plan WHEN 'engine' THEN 20 WHEN 'foundry' THEN 100 WHEN 'enterprise' THEN 500 END
      + v_addons * 5;
  END IF;
  v_details := jsonb_strip_nulls(jsonb_build_object(
    'stripe_invoice_id', v_invoice, 'stripe_subscription_id', v_subscription,
    'stripe_customer_id', v_customer, 'stripe_payment_intent_id', p_invoice->>'payment_intent_id',
    'billing_reason', v_reason, 'plan', v_plan, 'addons_count', v_addons,
    'stripe_event_id', p_invoice->>'event_id', 'paid_at', p_invoice->>'paid_at'
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
    customer_id, subscription_id, amount, currency, credits_granted, event_id)
  VALUES (v_invoice, v_site, v_payment.id, v_customer, v_subscription, v_amount, v_currency,
    v_credits, p_invoice->>'event_id');
  IF v_credits > 0 THEN
    UPDATE public.billing SET credits_available = coalesce(credits_available, 0) + v_credits,
      updated_at = now() WHERE site_id = v_site;
    INSERT INTO public.credit_transactions(site_id, amount, transaction_type, description, metadata)
    VALUES (v_site, v_credits, 'stripe_subscription_invoice', 'Credits for verified paid Stripe invoice',
      v_details || jsonb_build_object('payment_id', v_payment.id));
  END IF;
  RETURN jsonb_build_object('outcome', 'settled', 'payment_id', v_payment.id, 'credits_granted', v_credits);
END;
$$;
REVOKE ALL ON FUNCTION public.settle_stripe_subscription_invoice(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_stripe_subscription_invoice(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;