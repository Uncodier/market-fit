BEGIN;
SET LOCAL lock_timeout = '5s';

-- Forward correction: preserve the shared Temporal reset/not_due/stale_period
-- response and credits_granted while retaining the fourth-bucket renewal logic.
CREATE OR REPLACE FUNCTION public.renew_site_plan_credits(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE b public.billing%ROWTYPE; v_month timestamptz; v_start timestamptz; w record;
  v_expired numeric;
BEGIN
  SELECT * INTO b FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Billing record not found'); END IF;
  IF b.trial_ends_at <= clock_timestamp() AND b.trial_credits_available > 0 THEN
    UPDATE public.billing SET trial_credits_available=trial_credits_available
      WHERE id=b.id RETURNING * INTO b;
  END IF;
  IF EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NOT NULL)
    OR (coalesce(b.status,'') <> 'active' AND lower(coalesce(b.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired')) THEN
    IF b.plan_credits_available > 0 THEN
      v_expired := b.plan_credits_available;
      UPDATE public.billing SET plan_credits_available = 0,
        credits_available = purchased_credits_available + legacy_credits_available WHERE id = b.id RETURNING * INTO b;
      INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
        VALUES (p_site_id,-v_expired,'plan_credit_expiry','Inactive included plan allowance',
          jsonb_build_object('credit_bucket','plan','reason','inactive'));
    END IF;
    RETURN jsonb_build_object('success',true,'outcome','inactive','credits_granted',0,'credits_available',b.credits_available);
  END IF;
  IF b.stripe_subscription_id IS NOT NULL AND lower(coalesce(b.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired') THEN
    IF b.billing_interval = 'year' AND b.subscription_status = 'active'
      AND b.paid_subscription_period_start <= now() AND b.paid_subscription_period_end > now() THEN
      IF b.plan_credit_period_end > now() THEN
        RETURN jsonb_build_object('success',true,'outcome','not_due','credits_granted',0,'credits_available',b.credits_available);
      END IF;
      SELECT * INTO w FROM public.subscription_monthly_credit_window(
        coalesce(b.plan_credit_anchor,b.paid_subscription_period_start),b.paid_subscription_period_end,now());
      RETURN public.reset_site_plan_credit_period(p_site_id,w.period_start,w.period_end,
        public.site_plan_credit_allowance(b.paid_subscription_plan,b.paid_subscription_addons_count),
        'stripe_invoice:' || b.paid_subscription_invoice_id);
    END IF;
    IF (b.plan_credit_period_end <= now() OR b.paid_subscription_period_end <= now()) AND b.plan_credits_available > 0 THEN
      INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
        VALUES (p_site_id,-b.plan_credits_available,'plan_credit_expiry','Expired Stripe plan allowance',
          jsonb_build_object('credit_bucket','plan','period_end',b.plan_credit_period_end));
      UPDATE public.billing SET plan_credits_available = 0,
        credits_available = purchased_credits_available + legacy_credits_available WHERE id = b.id RETURNING * INTO b;
    END IF;
    IF b.paid_subscription_period_end <= now() THEN
      UPDATE public.billing SET plan='commission',addons_count=0 WHERE id=b.id RETURNING * INTO b;
    END IF;
    RETURN jsonb_build_object('success',true,'outcome','stripe_managed','credits_granted',0,'credits_available',b.credits_available);
  END IF;
  IF b.plan_credit_anchor IS NOT NULL AND b.plan_credit_period_end > now() THEN
    RETURN jsonb_build_object('success',true,'outcome','not_due','credits_granted',0,'credits_available',b.credits_available);
  END IF;
  v_month := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_start := CASE WHEN b.plan_credit_anchor IS NOT NULL AND b.plan_credit_period_end IS NOT NULL
    THEN greatest(v_month,b.plan_credit_period_end) ELSE v_month END;
  RETURN public.reset_site_plan_credit_period(p_site_id,v_start,(v_month AT TIME ZONE 'UTC' + interval '1 month') AT TIME ZONE 'UTC',
    public.site_plan_credit_allowance(b.plan,b.addons_count),'workflow');
END;
$$;
REVOKE ALL ON FUNCTION public.renew_site_plan_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_site_plan_credits(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;