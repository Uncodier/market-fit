BEGIN;
SET LOCAL lock_timeout = '5s';

-- This frontend deployment shares the API billing database. Never replace the
-- classified credit grant or plan-period renewal with an unclassified write.
DO $$
BEGIN
  IF to_regprocedure('public.renew_site_plan_credits(uuid)') IS NULL
    OR to_regprocedure('public.grant_purchased_site_credits(uuid,numeric,text,jsonb)') IS NULL
    OR to_regclass('public.billing_credit_grant_keys') IS NULL THEN
    RAISE EXCEPTION 'API classified credit and period migrations must be deployed first';
  END IF;
END;
$$;

-- The settings row is not a source of credit. The billing aggregate is the sole
-- threshold input; pending attempts reserve their full price until reconciled.
CREATE TABLE public.credit_auto_top_up_settings (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  minimum_credits numeric NOT NULL DEFAULT 5,
  target_credits numeric NOT NULL DEFAULT 20,
  max_monthly_spend_cents integer NOT NULL DEFAULT 10000,
  stripe_payment_method_id text,
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','paused')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_auto_top_up_settings_bounds CHECK (
    minimum_credits >= 0 AND minimum_credits <= 1000000
    AND target_credits > minimum_credits AND target_credits <= 1000000
    AND minimum_credits::text NOT IN ('NaN','Infinity','-Infinity')
    AND target_credits::text NOT IN ('NaN','Infinity','-Infinity')
    AND max_monthly_spend_cents BETWEEN 100 AND 100000000
    AND (stripe_payment_method_id IS NULL OR stripe_payment_method_id ~ '^pm_[A-Za-z0-9]+$')
  )
);

CREATE TABLE public.credit_auto_top_up_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 1000000),
  amount_cents integer NOT NULL CHECK (amount_cents = credits * 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  stripe_customer_id text NOT NULL CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  stripe_payment_method_id text NOT NULL CHECK (stripe_payment_method_id ~ '^pm_[A-Za-z0-9]+$'),
  stripe_payment_intent_id text UNIQUE CHECK (
    stripe_payment_intent_id IS NULL OR stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  claim_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT credit_auto_top_up_attempt_finished CHECK (
    (status = 'pending' AND finished_at IS NULL) OR
    (status <> 'pending' AND finished_at IS NOT NULL))
);
-- A pending Stripe operation is NEVER evicted because a clock/lease expired.
-- An expired lease only transfers ownership of the very same attempt/key.
CREATE UNIQUE INDEX credit_auto_top_up_one_pending_per_site
  ON public.credit_auto_top_up_attempts(site_id) WHERE status = 'pending';
CREATE INDEX credit_auto_top_up_monthly_spend
  ON public.credit_auto_top_up_attempts(site_id,created_at)
  WHERE status IN ('pending','succeeded');
-- Keep due recovery and per-site fairness scans index-backed. The latter
-- includes completed failures as well as successes so retry loops cannot monopolize a run.
CREATE INDEX credit_auto_top_up_pending_due
  ON public.credit_auto_top_up_attempts(claim_expires_at,created_at,site_id)
  WHERE status = 'pending';
CREATE INDEX credit_auto_top_up_latest_site_attempt
  ON public.credit_auto_top_up_attempts(site_id,created_at DESC);
CREATE INDEX credit_auto_top_up_enabled_sites
  ON public.credit_auto_top_up_settings(site_id)
  WHERE enabled AND state = 'ready';

ALTER TABLE public.credit_auto_top_up_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_auto_top_up_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.credit_auto_top_up_settings,public.credit_auto_top_up_attempts
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.credit_auto_top_up_settings,public.credit_auto_top_up_attempts TO service_role;

-- SECURITY DEFINER functions must not be exposed to browser roles, even if
-- RLS on these tables would otherwise deny browser reads/writes.
CREATE FUNCTION public.assert_credit_auto_top_up_service_role()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') IN ('anon','authenticated')
    OR (coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
      AND coalesce(current_setting('role',true),'') <> 'service_role') THEN
    RAISE EXCEPTION 'Automatic credit top-up requires service role';
  END IF;
END;
$$;

CREATE FUNCTION public.set_credit_auto_top_up_settings(
  p_site_id uuid,p_enabled boolean,p_minimum_credits numeric,p_target_credits numeric,
  p_max_monthly_spend_cents integer,p_stripe_payment_method_id text DEFAULT NULL,
  p_state text DEFAULT 'ready')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_settings%ROWTYPE;
  v_pm text;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_site_id IS NULL OR p_enabled IS NULL OR p_minimum_credits IS NULL
    OR p_target_credits IS NULL OR p_max_monthly_spend_cents IS NULL
    OR p_state IS NULL OR p_state NOT IN ('ready','paused')
    OR p_minimum_credits::text IN ('NaN','Infinity','-Infinity')
    OR p_target_credits::text IN ('NaN','Infinity','-Infinity')
    OR p_minimum_credits < 0 OR p_target_credits <= p_minimum_credits
    OR p_target_credits > 1000000 OR p_max_monthly_spend_cents NOT BETWEEN 100 AND 100000000
    OR (p_stripe_payment_method_id IS NOT NULL AND p_stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$')
  THEN RAISE EXCEPTION 'Invalid automatic credit top-up settings'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing record not found'; END IF;
  SELECT * INTO s FROM public.credit_auto_top_up_settings WHERE site_id=p_site_id FOR UPDATE;
  v_pm := coalesce(p_stripe_payment_method_id,s.stripe_payment_method_id);
  -- Paused settings may be disabled/reconfigured but NEVER unpaused here.
  -- New cards are registered through attach_credit_auto_top_up_payment_method
  -- after the service has checked their Stripe customer ownership.
  IF p_stripe_payment_method_id IS NOT NULL
    AND p_stripe_payment_method_id IS DISTINCT FROM s.stripe_payment_method_id
  THEN
    RAISE EXCEPTION 'Payment method must first be verified against the Stripe customer';
  END IF;
  IF p_enabled AND (v_pm IS NULL OR b.stripe_customer_id IS NULL) THEN
    RAISE EXCEPTION 'A verified Stripe customer and payment method are required';
  END IF;
  INSERT INTO public.credit_auto_top_up_settings
    (site_id,enabled,minimum_credits,target_credits,max_monthly_spend_cents,stripe_payment_method_id,state)
  VALUES (p_site_id,p_enabled,p_minimum_credits,p_target_credits,p_max_monthly_spend_cents,v_pm,p_state)
  ON CONFLICT (site_id) DO UPDATE SET
    enabled=excluded.enabled,minimum_credits=excluded.minimum_credits,
    target_credits=excluded.target_credits,max_monthly_spend_cents=excluded.max_monthly_spend_cents,
    stripe_payment_method_id=excluded.stripe_payment_method_id,
    state=CASE WHEN public.credit_auto_top_up_settings.state='paused' THEN 'paused'
      ELSE excluded.state END,updated_at=now();
  RETURN jsonb_build_object('success',true,'outcome','saved','site_id',p_site_id);
END;
$$;

-- The service must retrieve the Stripe PM and verify its customer before calling.
-- A supplied customer is also checked against the billing row under the lock.
CREATE FUNCTION public.attach_credit_auto_top_up_payment_method(
  p_site_id uuid,p_stripe_payment_method_id text,p_stripe_customer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_site_id IS NULL OR p_stripe_payment_method_id IS NULL
    OR p_stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$'
    OR p_stripe_customer_id IS NULL OR p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
  THEN RAISE EXCEPTION 'Invalid verified Stripe payment method'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR b.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id THEN
    RAISE EXCEPTION 'Stripe customer does not match billing account';
  END IF;
  INSERT INTO public.credit_auto_top_up_settings(site_id,stripe_payment_method_id)
    VALUES (p_site_id,p_stripe_payment_method_id)
  ON CONFLICT (site_id) DO UPDATE SET
    stripe_payment_method_id=excluded.stripe_payment_method_id,updated_at=now();
  RETURN jsonb_build_object('success',true,'outcome','attached','site_id',p_site_id);
END;
$$;

-- This discovery RPC does not charge, reserve, or grant anything. The claim
-- RPC rechecks the renewed billing aggregate under its billing row lock. Discovery
-- subtracts expired included credits so a stale aggregate cannot hide a site.
-- Keep pending work independent of settings: disabling/pausing must not lose
-- Stripe reconciliation. No unrecorded PI >23h is queued for automatic retry.
-- When both classes exist, at most half the batch is due recovery so a stuck
-- Stripe intent cannot indefinitely starve new low-balance sites.
CREATE FUNCTION public.list_credit_auto_top_up_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE(site_id uuid) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,pg_temp AS $$
DECLARE v_now timestamptz := now();
  v_month timestamptz := date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_next_month timestamptz;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid automatic top-up candidate limit';
  END IF;
  v_next_month := (v_month AT TIME ZONE 'UTC' + interval '1 month') AT TIME ZONE 'UTC';
  RETURN QUERY
  WITH eligible AS (
    SELECT s.site_id AS candidate_site_id, recent.created_at AS ordering_time
      FROM public.credit_auto_top_up_settings s
      JOIN public.billing b ON b.site_id=s.site_id
      JOIN public.sites t ON t.id=s.site_id
      CROSS JOIN LATERAL (
        SELECT b.credits_available - CASE WHEN b.plan_credit_period_end <= v_now
            OR (b.stripe_subscription_id IS NOT NULL
              AND b.paid_subscription_period_end <= v_now)
          THEN b.plan_credits_available ELSE 0 END AS balance
      ) effective
      LEFT JOIN LATERAL (
        SELECT a.created_at FROM public.credit_auto_top_up_attempts a
          WHERE a.site_id=s.site_id ORDER BY a.created_at DESC LIMIT 1
      ) recent ON true
      WHERE s.enabled AND s.state='ready' AND s.stripe_payment_method_id IS NOT NULL
        AND b.status='active' AND b.stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'
        AND t.archived_at IS NULL AND effective.balance < s.minimum_credits
        AND ceil(s.target_credits-effective.balance) BETWEEN 1 AND 1000000
        AND NOT EXISTS (SELECT 1 FROM public.credit_auto_top_up_attempts pending
          WHERE pending.site_id=s.site_id AND pending.status='pending')
        AND (SELECT coalesce(sum(spent.amount_cents),0)
          FROM public.credit_auto_top_up_attempts spent
          WHERE spent.site_id=s.site_id AND spent.created_at >= v_month
            AND spent.created_at < v_next_month
            AND spent.status IN ('pending','succeeded'))
          + ceil(s.target_credits-effective.balance)*100 <= s.max_monthly_spend_cents
      ORDER BY recent.created_at ASC NULLS FIRST,s.site_id
      LIMIT p_limit
  ), due AS (
    SELECT a.site_id AS candidate_site_id, a.claim_expires_at AS ordering_time
      FROM public.credit_auto_top_up_attempts a
      JOIN public.billing b ON b.site_id=a.site_id
      WHERE a.status='pending' AND a.claim_expires_at <= v_now
        AND (a.stripe_payment_intent_id IS NOT NULL
          OR a.created_at >= v_now - interval '23 hours')
      ORDER BY a.claim_expires_at,a.created_at,a.site_id
      LIMIT CASE WHEN EXISTS (SELECT 1 FROM eligible)
        THEN greatest(1,(p_limit+1)/2) ELSE p_limit END
  )
  SELECT candidates.candidate_site_id
    FROM (SELECT 0 AS priority,due.candidate_site_id,due.ordering_time FROM due
      UNION ALL
      SELECT 1 AS priority,eligible.candidate_site_id,eligible.ordering_time FROM eligible
    ) candidates
    ORDER BY candidates.priority,candidates.ordering_time ASC NULLS FIRST,
      candidates.candidate_site_id
    LIMIT p_limit;
END;
$$;

CREATE FUNCTION public.begin_credit_auto_top_up_attempt(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_settings%ROWTYPE;
  a public.credit_auto_top_up_attempts%ROWTYPE; v_credits integer; v_cents integer;
  v_spent bigint; v_month timestamptz;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_site_id IS NULL THEN RAISE EXCEPTION 'Site required'; END IF;
  -- renew_site_plan_credits serializes on billing and removes expired plan
  -- credits before the aggregate threshold can be evaluated.
  PERFORM public.renew_site_plan_credits(p_site_id);
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'outcome','not_eligible'); END IF;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND status='pending' FOR UPDATE;
  IF FOUND THEN
    IF a.claim_expires_at > now() THEN
      RETURN jsonb_build_object('success',true,'outcome','in_progress','attempt_id',a.id);
    END IF;
    -- Stripe may forget idempotency keys after 24 hours. When no PI identity
    -- was durably recorded, do not risk creating a second payment after 23h.
    IF a.stripe_payment_intent_id IS NULL AND a.created_at < now()-interval '23 hours' THEN
      RETURN jsonb_build_object('success',true,'outcome','needs_reconciliation','attempt_id',a.id);
    END IF;
    UPDATE public.credit_auto_top_up_attempts SET claim_token=gen_random_uuid(),
      claim_expires_at=now()+interval '10 minutes' WHERE id=a.id RETURNING * INTO a;
  ELSE
    SELECT * INTO s FROM public.credit_auto_top_up_settings WHERE site_id=p_site_id FOR UPDATE;
    IF NOT FOUND OR NOT s.enabled OR s.state <> 'ready'
      OR b.status IS DISTINCT FROM 'active'
      OR NOT EXISTS (SELECT 1 FROM public.sites WHERE id=p_site_id AND archived_at IS NULL)
      OR b.stripe_customer_id IS NULL OR b.stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
      OR s.stripe_payment_method_id IS NULL OR b.credits_available >= s.minimum_credits THEN
      RETURN jsonb_build_object('success',true,'outcome','not_eligible');
    END IF;
    v_credits := ceil(s.target_credits-b.credits_available)::integer;
    IF v_credits < 1 OR v_credits > 1000000 THEN
      RETURN jsonb_build_object('success',true,'outcome','not_eligible');
    END IF;
    v_cents := v_credits*100; -- fixed $1 per credit; never use client pricing
    v_month := date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    SELECT coalesce(sum(amount_cents),0) INTO v_spent
      FROM public.credit_auto_top_up_attempts WHERE site_id=p_site_id
      AND created_at >= v_month
      AND created_at < (v_month AT TIME ZONE 'UTC'+interval '1 month') AT TIME ZONE 'UTC'
      AND status IN ('pending','succeeded');
    IF v_spent+v_cents > s.max_monthly_spend_cents THEN
      RETURN jsonb_build_object('success',true,'outcome','not_eligible','reason','monthly_cap');
    END IF;
    INSERT INTO public.credit_auto_top_up_attempts
      (site_id,credits,amount_cents,stripe_customer_id,stripe_payment_method_id,claim_expires_at)
    VALUES (p_site_id,v_credits,v_cents,b.stripe_customer_id,s.stripe_payment_method_id,
      now()+interval '10 minutes') RETURNING * INTO a;
  END IF;
  RETURN jsonb_build_object('success',true,'outcome','claimed','attempt_id',a.id,
    'idempotency_key','credit-auto-top-up-'||a.id::text,
    'claim_token',a.claim_token,'claim_expires_at',a.claim_expires_at,
    'credits',a.credits,'amount_cents',a.amount_cents,
    'stripe_customer_id',a.stripe_customer_id,
    'stripe_payment_method_id',a.stripe_payment_method_id,
    'stripe_payment_intent_id',a.stripe_payment_intent_id);
END;
$$;

CREATE FUNCTION public.record_credit_auto_top_up_intent(
  p_site_id uuid,p_attempt_id uuid,p_claim_token uuid,p_stripe_payment_intent_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE a public.credit_auto_top_up_attempts%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
  THEN RAISE EXCEPTION 'Valid Stripe payment intent required'; END IF;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'pending' OR a.claim_token IS DISTINCT FROM p_claim_token
    OR (a.stripe_payment_intent_id IS NOT NULL
      AND a.stripe_payment_intent_id <> p_stripe_payment_intent_id) THEN
    RAISE EXCEPTION 'Stale or conflicting automatic top-up intent';
  END IF;
  UPDATE public.credit_auto_top_up_attempts SET stripe_payment_intent_id=p_stripe_payment_intent_id
    WHERE id=a.id;
  RETURN jsonb_build_object('success',true,'outcome','recorded','attempt_id',a.id);
END;
$$;

-- Only call this after Stripe retrieve/webhook verifies status=succeeded,
-- amount/currency/customer and metadata.attempt_id. A random PI id is NOT proof
-- of payment; this RPC is restricted to trusted service-side verification.
CREATE FUNCTION public.complete_credit_auto_top_up_attempt(
  p_site_id uuid,p_attempt_id uuid,p_claim_token uuid,p_stripe_payment_intent_id text,
  p_stripe_customer_id text,p_amount_cents integer,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; a public.credit_auto_top_up_attempts%ROWTYPE;
  v_grant jsonb; v_payment public.payments%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    OR p_currency IS DISTINCT FROM 'usd' THEN
    RAISE EXCEPTION 'Invalid verified Stripe settlement';
  END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing record not found'; END IF;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id
    OR a.amount_cents IS DISTINCT FROM p_amount_cents
    OR a.stripe_payment_intent_id IS DISTINCT FROM p_stripe_payment_intent_id THEN
    RAISE EXCEPTION 'Stripe top-up settlement identity mismatch';
  END IF;
  IF a.status = 'succeeded' THEN
    RETURN jsonb_build_object('success',true,'outcome','duplicate','attempt_id',a.id);
  END IF;
  IF a.status <> 'pending' OR a.claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'Stale or terminal automatic top-up attempt';
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE transaction_id=p_stripe_payment_intent_id;
  IF FOUND AND (v_payment.site_id IS DISTINCT FROM p_site_id
    OR v_payment.status IS DISTINCT FROM 'completed'
    OR v_payment.transaction_type IS DISTINCT FROM 'credits_purchase'
    OR v_payment.credits IS DISTINCT FROM a.credits
    OR v_payment.amount IS DISTINCT FROM (a.amount_cents::numeric/100)) THEN
    RAISE EXCEPTION 'Stripe payment identity already used';
  END IF;
  v_grant := public.grant_purchased_site_credits(p_site_id,a.credits,p_stripe_payment_intent_id,
    jsonb_build_object('auto_top_up_attempt_id',a.id,'stripe_payment_intent_id',p_stripe_payment_intent_id));
  IF v_grant->>'outcome' IS DISTINCT FROM 'granted' THEN
    RAISE EXCEPTION 'Automatic top-up credit grant requires reconciliation';
  END IF;
  INSERT INTO public.payments(site_id,transaction_id,transaction_type,amount,currency,
    status,payment_method,credits,details)
  VALUES (p_site_id,p_stripe_payment_intent_id,'credits_purchase',a.amount_cents::numeric/100,
    'USD','completed','stripe',a.credits,jsonb_build_object(
      'auto_top_up_attempt_id',a.id,'stripe_payment_intent_id',p_stripe_payment_intent_id,
      'stripe_customer_id',a.stripe_customer_id));
  UPDATE public.credit_auto_top_up_attempts SET status='succeeded',finished_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('success',true,'outcome','succeeded','attempt_id',a.id,'credits_granted',a.credits);
END;
$$;

-- Only call with a VERIFIED canceled Stripe intent. Timeouts,
-- requires_action, requires_payment_method, processing and unknown errors
-- MUST keep the reservation. Only Stripe-canceled intents can release it.
CREATE FUNCTION public.fail_credit_auto_top_up_attempt(
  p_site_id uuid,p_attempt_id uuid,p_claim_token uuid,
  p_stripe_payment_intent_id text,p_stripe_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; a public.credit_auto_top_up_attempts%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    OR p_stripe_status IS NULL OR p_stripe_status <> 'canceled'
  THEN RAISE EXCEPTION 'Verified terminal nonpaying Stripe intent required'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing record not found'; END IF;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR (a.stripe_payment_intent_id IS NOT NULL
    AND a.stripe_payment_intent_id <> p_stripe_payment_intent_id) THEN
    RAISE EXCEPTION 'Automatic top-up failure identity mismatch';
  END IF;
  IF a.status = 'failed' THEN
    RETURN jsonb_build_object('success',true,'outcome','duplicate','attempt_id',a.id);
  END IF;
  IF a.status <> 'pending' OR a.claim_token IS DISTINCT FROM p_claim_token THEN
    RAISE EXCEPTION 'Stale or terminal automatic top-up attempt';
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_credit_grant_keys
    WHERE idempotency_key=p_stripe_payment_intent_id)
    OR EXISTS (SELECT 1 FROM public.payments WHERE transaction_id=p_stripe_payment_intent_id
      AND status='completed') THEN
    RAISE EXCEPTION 'Cannot fail an already credited Stripe intent';
  END IF;
  UPDATE public.credit_auto_top_up_attempts
    SET status='failed',stripe_payment_intent_id=p_stripe_payment_intent_id,finished_at=now()
    WHERE id=a.id;
  UPDATE public.credit_auto_top_up_settings SET state='paused',updated_at=now()
    WHERE site_id=p_site_id;
  RETURN jsonb_build_object('success',true,'outcome','failed','attempt_id',a.id);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_credit_auto_top_up_service_role(),
  public.set_credit_auto_top_up_settings(uuid,boolean,numeric,numeric,integer,text,text),
  public.attach_credit_auto_top_up_payment_method(uuid,text,text),
  public.begin_credit_auto_top_up_attempt(uuid),
  public.list_credit_auto_top_up_candidates(integer),
  public.record_credit_auto_top_up_intent(uuid,uuid,uuid,text),
  public.complete_credit_auto_top_up_attempt(uuid,uuid,uuid,text,text,integer,text),
  public.fail_credit_auto_top_up_attempt(uuid,uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_credit_auto_top_up_settings(uuid,boolean,numeric,numeric,integer,text,text),
  public.attach_credit_auto_top_up_payment_method(uuid,text,text),
  public.begin_credit_auto_top_up_attempt(uuid),
  public.list_credit_auto_top_up_candidates(integer),
  public.record_credit_auto_top_up_intent(uuid,uuid,uuid,text),
  public.complete_credit_auto_top_up_attempt(uuid,uuid,uuid,text,text,integer,text),
  public.fail_credit_auto_top_up_attempt(uuid,uuid,uuid,text,text)
  TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
