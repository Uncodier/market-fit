BEGIN;
SET LOCAL lock_timeout = '5s';

-- Full forward replacements of the shared API classified guard and renewal/debit.
-- Existing browser financial protection and stale Stripe identity fencing remain.

CREATE OR REPLACE FUNCTION public.guard_billing_credit_buckets()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_browser boolean := coalesce(auth.role(), '') IN ('anon','authenticated')
    OR coalesce(current_setting('role',true),'') IN ('anon','authenticated');
  v_terminal boolean := lower(coalesce(NEW.subscription_status, '')) IN ('canceled','cancelled','incomplete_expired');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    RAISE EXCEPTION 'Billing tenant identity is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND lower(coalesce(OLD.subscription_status,'')) IN ('canceled','cancelled','incomplete_expired')
    AND NOT v_terminal AND NEW.stripe_subscription_id IS NOT DISTINCT FROM OLD.stripe_subscription_id
    AND OLD.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'A terminated Stripe subscription cannot be reactivated by a stale event';
  END IF;
  IF v_browser AND NOT (
    EXISTS (SELECT 1 FROM public.sites WHERE id = NEW.site_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.site_ownership WHERE site_id = NEW.site_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.site_members WHERE site_id = NEW.site_id AND user_id = auth.uid()
      AND status = 'active' AND role IN ('owner','admin'))
  ) THEN RAISE EXCEPTION 'Billing manager authorization required'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF v_browser THEN RAISE EXCEPTION 'Billing initialization requires the authorized server'; END IF;
    IF coalesce(NEW.credits_available, 0) <> NEW.plan_credits_available + NEW.purchased_credits_available + NEW.legacy_credits_available + NEW.trial_credits_available THEN
      RAISE EXCEPTION 'Use initialize_site_billing or a classified credit RPC';
    END IF;
  ELSE
    IF v_browser AND ROW(NEW.plan,NEW.credits_available,NEW.credits_used,NEW.account_balance,
      NEW.plan_credits_available,NEW.purchased_credits_available,NEW.legacy_credits_available,NEW.trial_credits_available,
      NEW.monthly_credits_used,NEW.plan_credits_used,NEW.plan_credit_allowance,NEW.plan_credit_period_start,NEW.plan_credit_period_end,
      NEW.subscription_status,NEW.stripe_customer_id,NEW.stripe_subscription_id,NEW.addons_count,NEW.auto_renew,
      NEW.created_at,NEW.subscription_start_date,NEW.subscription_end_date,NEW.subscription_current_period_end,NEW.status,NEW.plan_credit_source)
      IS DISTINCT FROM ROW(OLD.plan,OLD.credits_available,OLD.credits_used,OLD.account_balance,
      OLD.plan_credits_available,OLD.purchased_credits_available,OLD.legacy_credits_available,OLD.trial_credits_available,
      OLD.monthly_credits_used,OLD.plan_credits_used,OLD.plan_credit_allowance,OLD.plan_credit_period_start,OLD.plan_credit_period_end,
      OLD.subscription_status,OLD.stripe_customer_id,OLD.stripe_subscription_id,OLD.addons_count,OLD.auto_renew,
      OLD.created_at,OLD.subscription_start_date,OLD.subscription_end_date,OLD.subscription_current_period_end,OLD.status,OLD.plan_credit_source)
      THEN RAISE EXCEPTION 'Financial billing fields are server managed'; END IF;
    IF NEW.credits_available IS DISTINCT FROM OLD.credits_available
      AND ROW(NEW.plan_credits_available,NEW.purchased_credits_available,NEW.legacy_credits_available,NEW.trial_credits_available)
        IS NOT DISTINCT FROM ROW(OLD.plan_credits_available,OLD.purchased_credits_available,OLD.legacy_credits_available,OLD.trial_credits_available)
      AND NOT (NEW.trial_credits_available > 0 AND NEW.credits_available =
        NEW.plan_credits_available + NEW.purchased_credits_available + NEW.legacy_credits_available)
      THEN RAISE EXCEPTION 'Aggregate-only credit writes are disabled; use a classified credit RPC'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT v_terminal AND NEW.stripe_subscription_id IS NOT NULL
    AND NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    -- A different verified subscription needs its own paid invoice. Metadata
    -- synchronization does not grant credits or inherit the previous paid period.
    NEW.plan_credit_source := 'stripe_unverified';
    NEW.plan_credits_available := 0;
  END IF;
  IF v_terminal THEN
    NEW.plan := 'commission'; NEW.addons_count := 0; NEW.plan_credit_allowance := 1;
    IF TG_OP = 'INSERT' OR lower(coalesce(OLD.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired') THEN
      NEW.plan_credits_available := 1; NEW.monthly_credits_used := 0; NEW.plan_credits_used := 0;
      NEW.plan_credit_source := 'toolbox';
      NEW.plan_credit_period_start := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
      NEW.plan_credit_period_end := (NEW.plan_credit_period_start AT TIME ZONE 'UTC' + interval '1 month') AT TIME ZONE 'UTC';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.addons_count IS DISTINCT FROM OLD.addons_count)
    AND NEW.stripe_subscription_id IS NULL THEN
    -- Server-authorized partner licenses change entitlement without touching
    -- bought money. Repeating the same plan does not refill spent credits.
    NEW.plan_credit_allowance := public.site_plan_credit_allowance(NEW.plan,NEW.addons_count);
    NEW.plan_credits_available := greatest(NEW.plan_credit_allowance - OLD.plan_credits_used,0);
  END IF;
  NEW.credits_available := NEW.plan_credits_available + NEW.purchased_credits_available + NEW.legacy_credits_available + NEW.trial_credits_available;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_site_plan_credit_period(p_site_id uuid,p_period_start timestamptz,
  p_period_end timestamptz,p_allowance numeric,p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE b public.billing%ROWTYPE; v_delta numeric;
BEGIN
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start
    OR NOT isfinite(p_period_start) OR NOT isfinite(p_period_end)
    OR p_period_start > now() OR p_period_end <= now()
    OR p_allowance IS NULL OR p_allowance < 0 OR p_allowance::text IN ('NaN','Infinity','-Infinity')
    OR nullif(p_source,'') IS NULL THEN RAISE EXCEPTION 'Invalid current plan credit period'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Billing record not found'); END IF;
  -- Legacy Stripe metadata proves the period END, not its start (month-end
  -- clamping can make end-minus-one-month inaccurate). Invoice replay of that
  -- same paid end must not refill consumed credits, even if its exact start differs.
  IF p_source LIKE 'stripe_invoice:%' AND b.plan_credit_source LIKE 'stripe%'
    AND b.plan_credit_source <> 'stripe_unverified' AND p_period_end <= b.plan_credit_period_end THEN
    RETURN jsonb_build_object('success',true,'outcome',CASE WHEN p_period_end < b.plan_credit_period_end THEN 'stale_period' ELSE 'not_due' END,
      'credits_granted',0,'credits_available',b.credits_available,'expired_credits',0);
  END IF;
  IF b.plan_credit_period_start IS NOT NULL AND p_period_start <= b.plan_credit_period_start
    AND NOT (p_source LIKE 'stripe_invoice:%' AND b.plan_credit_source IN ('signup','stripe_unverified')) THEN
    RETURN jsonb_build_object('success',true,'outcome',CASE WHEN p_period_start < b.plan_credit_period_start THEN 'stale_period' ELSE 'not_due' END,
      'credits_granted',0,'credits_available',b.credits_available,'expired_credits',0);
  END IF;
  v_delta := p_allowance - b.plan_credits_available;
  UPDATE public.billing SET plan_credits_available = p_allowance,
    credits_available = p_allowance + purchased_credits_available + legacy_credits_available,
    plan_credit_allowance = p_allowance,plan_credit_period_start = p_period_start,
    plan_credit_period_end = p_period_end,plan_credit_source = p_source,monthly_credits_used = 0,plan_credits_used = 0 WHERE id = b.id;
  INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
    VALUES (p_site_id,v_delta,'plan_credit_reset','Non-accumulating monthly plan allowance',
      jsonb_build_object('credit_bucket','plan','source',p_source,'period_start',p_period_start,
        'period_end',p_period_end,'allowance',p_allowance,'expired_credits',b.plan_credits_available));
  RETURN jsonb_build_object('success',true,'outcome','reset','credits_granted',p_allowance,
    'credits_available',p_allowance + b.purchased_credits_available + b.legacy_credits_available + b.trial_credits_available,
    'expired_credits',b.plan_credits_available);
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_site_plan_credits(p_site_id uuid)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DECLARE b public.billing%ROWTYPE; v_month timestamptz; v_start timestamptz; w record;
  BEGIN
    SELECT * INTO b FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Billing record not found'); END IF;
    -- Evaluate expiry AFTER acquiring the serialization lock. A debit queued
    -- before expiry cannot spend the trial after waiting across its boundary.
    IF b.trial_ends_at <= clock_timestamp() AND b.trial_credits_available > 0 THEN
      UPDATE public.billing SET trial_credits_available=trial_credits_available
        WHERE id=b.id RETURNING * INTO b;
    END IF;
    IF EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NOT NULL)
      OR (coalesce(b.status,'') <> 'active' AND lower(coalesce(b.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired')) THEN
      IF b.plan_credits_available > 0 THEN
        UPDATE public.billing SET plan_credits_available = 0,
          credits_available = purchased_credits_available + legacy_credits_available WHERE id = b.id;
        INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
          VALUES (p_site_id,-b.plan_credits_available,'plan_credit_expiry','Inactive included plan allowance',
            jsonb_build_object('credit_bucket','plan','reason','inactive'));
        b.credits_available := b.purchased_credits_available + b.legacy_credits_available + b.trial_credits_available;
      END IF;
      RETURN jsonb_build_object('success',true,'outcome','inactive','credits_granted',0,'credits_available',b.credits_available);
    END IF;
    IF b.stripe_subscription_id IS NOT NULL AND lower(coalesce(b.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired') THEN
      IF b.billing_interval = 'year' AND b.subscription_status = 'active'
        AND b.paid_subscription_period_start <= now() AND b.paid_subscription_period_end > now() THEN
        IF b.plan_credit_period_end > now() THEN
          RETURN jsonb_build_object('success',true,'outcome','not_due','credits_granted',0,
            'credits_available',b.credits_available);
        END IF;
        SELECT * INTO w FROM public.subscription_monthly_credit_window(
          coalesce(b.plan_credit_anchor,b.paid_subscription_period_start),b.paid_subscription_period_end,now());
        RETURN public.reset_site_plan_credit_period(p_site_id,w.period_start,w.period_end,
          public.site_plan_credit_allowance(b.paid_subscription_plan,b.paid_subscription_addons_count),
          'stripe_invoice:' || b.paid_subscription_invoice_id);
      END IF;
      IF (b.plan_credit_period_end <= now() OR b.paid_subscription_period_end <= now()) AND b.plan_credits_available > 0 THEN
        UPDATE public.billing SET plan_credits_available = 0,
          credits_available = purchased_credits_available + legacy_credits_available WHERE id = b.id;
        INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
          VALUES (p_site_id,-b.plan_credits_available,'plan_credit_expiry','Expired Stripe plan allowance',
            jsonb_build_object('credit_bucket','plan','period_end',b.plan_credit_period_end));
        b.credits_available := b.purchased_credits_available + b.legacy_credits_available + b.trial_credits_available;
      END IF;
      IF b.paid_subscription_period_end <= now() THEN
        -- Delayed/missing Stripe renewal events are not proof of paid benefits.
        UPDATE public.billing SET plan='commission',addons_count=0 WHERE id=b.id;
      END IF;
      RETURN jsonb_build_object('success',true,'outcome','stripe_managed','credits_granted',0,'credits_available',b.credits_available);
    END IF;
    -- The terminal trigger grants only the Toolbox allowance and retains the
    -- previous paid window/usage. Keep that boundary even when the calendar month
    -- changes. A replacement invoice reads this usage under the same billing lock.
    IF b.plan_credit_anchor IS NOT NULL AND b.plan_credit_period_end > now() THEN
      RETURN jsonb_build_object('success',true,'outcome','not_due','credits_granted',0,
        'credits_available',b.credits_available);
    END IF;
    v_month := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    -- Once the preserved window ends, begin the remaining Toolbox month no
    -- earlier than that boundary. The next expiry stays on the UTC month-end,
    -- not a shifted anniversary of the old Stripe subscription.
    v_start := CASE WHEN b.plan_credit_anchor IS NOT NULL AND b.plan_credit_period_end IS NOT NULL
      THEN greatest(v_month,b.plan_credit_period_end) ELSE v_month END;
    PERFORM public.reset_site_plan_credit_period(p_site_id,v_start,(v_month AT TIME ZONE 'UTC' + interval '1 month') AT TIME ZONE 'UTC',
      public.site_plan_credit_allowance(b.plan,b.addons_count),'workflow');
    RETURN jsonb_build_object('success',true,'outcome','renewed','credits_available',
      (SELECT credits_available FROM public.billing WHERE site_id=p_site_id));
  END;
  $$;

CREATE OR REPLACE FUNCTION public.deduct_credits(p_site_id uuid,p_amount numeric,p_type text,
  p_description text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE b public.billing%ROWTYPE; v_trial numeric; v_plan numeric; v_legacy numeric; v_purchase numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN','Infinity','-Infinity')
    OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid credit deduction'; END IF;
  -- Lazy renewal prevents stale included credits being spent before a daily job.
  PERFORM public.renew_site_plan_credits(p_site_id);
  SELECT * INTO b FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Billing record not found'); END IF;
  IF b.credits_available < p_amount THEN
    RETURN jsonb_build_object('success',false,'error','Insufficient credits','available',b.credits_available,'required',p_amount);
  END IF;
  v_trial := least(b.trial_credits_available,p_amount);
  v_plan := least(b.plan_credits_available,p_amount - v_trial);
  v_legacy := least(b.legacy_credits_available,p_amount - v_trial - v_plan);
  v_purchase := p_amount - v_trial - v_plan - v_legacy;
  UPDATE public.billing SET trial_credits_available = trial_credits_available - v_trial,
    plan_credits_available = plan_credits_available - v_plan,
    legacy_credits_available = legacy_credits_available - v_legacy,
    purchased_credits_available = purchased_credits_available - v_purchase,
    credits_available = credits_available - p_amount,credits_used = coalesce(credits_used,0) + p_amount,
    monthly_credits_used = monthly_credits_used + p_amount,plan_credits_used = plan_credits_used + v_plan WHERE id = b.id;
  INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
    VALUES (p_site_id,-p_amount,p_type,p_description,p_metadata || jsonb_build_object(
      'trial_credits_spent',v_trial,'plan_credits_spent',v_plan,'legacy_credits_spent',v_legacy,'purchased_credits_spent',v_purchase));
  RETURN jsonb_build_object('success',true,'remaining',b.credits_available - p_amount);
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
