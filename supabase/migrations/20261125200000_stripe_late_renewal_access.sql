BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;

-- Preserve the exact base predicate for admission and mirror writers. Only
-- change the reviewed role/access readers, preserving their existing grants.
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM (VALUES
    ('public.site_member_has_effective_license(uuid)','bfb9988c716dd8146b99f02c99a6046e','{postgres=X/postgres}'),
    ('public.current_user_site_role(uuid)','8e961829a942f8e7973ca1b208c97237','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
    ('public.site_user_has_effective_access(uuid,uuid)','0d9f42f48c069f973598add2327019b7','{postgres=X/postgres,service_role=X/postgres}')
  ) AS expected(signature,body_md5,acl)
  LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(expected.signature)
  WHERE p.oid IS NULL OR md5(p.prosrc)<>expected.body_md5 OR p.proowner<>'postgres'::regrole
    OR NOT p.prosecdef OR p.provolatile<>'s' OR p.proisstrict
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp','row_security=off']
    OR p.proacl::text IS DISTINCT FROM expected.acl)
  THEN RAISE EXCEPTION 'Member licensing or access function differs from the reviewed baseline'; END IF;
END;
$preflight$;

-- Access only. Never rewrite Stripe lifecycle, billing, settlement, or credit
-- state. No backfill: a paid invoice alone lacks the provider attestation.
CREATE TABLE public.stripe_late_renewal_access (
  invoice_id text PRIMARY KEY REFERENCES public.stripe_subscription_invoice_settlements(invoice_id),
  site_id uuid NOT NULL,
  billing_id uuid NOT NULL,
  customer_id text NOT NULL,
  subscription_id text NOT NULL UNIQUE,
  charge_id text NOT NULL UNIQUE,
  payment_intent_id text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('engine','foundry','enterprise')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  paid_at timestamptz NOT NULL,
  CHECK (isfinite(period_start) AND isfinite(period_end) AND isfinite(ended_at) AND isfinite(paid_at)
    AND period_start <= ended_at AND ended_at <= paid_at AND paid_at < period_end
    AND period_end - period_start <= interval '31 days')
);

-- Retain even without a proof: an out-of-order payment delivery must not undo
-- a successful refund or a dispute already seen for the same charge.
CREATE TABLE public.stripe_late_renewal_reversals (
  charge_id text PRIMARY KEY CHECK (charge_id ~ '^ch_[A-Za-z0-9]+$')
);

ALTER TABLE public.stripe_late_renewal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_late_renewal_reversals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_late_renewal_access, public.stripe_late_renewal_reversals
  FROM PUBLIC, anon, authenticated, service_role;

-- Shared boundary for the entitlement and the checkout deferral. Existing
-- retirement fences prevent a replaced subscription ID from being rebound.
CREATE FUNCTION public.bound_stripe_late_renewal_access(
  p_site_id uuid,p_billing_id uuid,p_customer_id text,p_subscription_id text,p_ended_at timestamptz
) RETURNS public.stripe_late_renewal_access LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp AS $$
  SELECT a.* FROM public.stripe_late_renewal_access a
  WHERE a.subscription_id=p_subscription_id AND a.customer_id=p_customer_id
    AND a.site_id=p_site_id AND a.billing_id=p_billing_id AND a.ended_at=p_ended_at
    AND NOT EXISTS (SELECT 1 FROM public.stripe_late_renewal_reversals r WHERE r.charge_id=a.charge_id)
    AND NOT EXISTS (SELECT 1 FROM public.site_retired_stripe_subscriptions r
      WHERE r.site_id=p_site_id AND r.subscription_id=p_subscription_id);
$$;
REVOKE ALL ON FUNCTION public.bound_stripe_late_renewal_access(uuid,uuid,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

-- Only access readers may use this overlay. The baseline predicate continues
-- to drive admission, mirrors, and product-specific authorization. A base
-- seat (e.g. a higher trial) always wins regardless of the late invoice tier.
CREATE FUNCTION public.site_member_has_access_seat(p_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE WHEN public.site_member_has_effective_license(p_member_id) THEN true ELSE EXISTS (
    SELECT 1 FROM public.site_members m
    JOIN public.sites s ON s.id=m.site_id AND s.archived_at IS NULL
    JOIN public.billing b ON b.site_id=m.site_id
    CROSS JOIN LATERAL public.bound_stripe_late_renewal_access(
      b.site_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.subscription_end_date) a
    CROSS JOIN (SELECT clock_timestamp() AS checked_at) t
    WHERE m.id=p_member_id AND m.status='active' AND NOT m.manually_disabled
      AND m.user_id IS NOT NULL AND m.created_at <= a.ended_at
      AND b.status='active' AND b.subscription_status='canceled' AND b.auto_renew IS FALSE
      AND a.paid_at <= t.checked_at AND a.period_start <= t.checked_at AND a.period_end > t.checked_at
      AND (
        SELECT count(*) FROM public.site_members earlier
        WHERE earlier.site_id=m.site_id AND earlier.user_id IS DISTINCT FROM s.user_id
          AND earlier.status IN ('active','pending') AND NOT earlier.manually_disabled
          AND (coalesce(earlier.created_at,'infinity'::timestamptz),earlier.id) <= (m.created_at,m.id)
      ) < CASE a.plan WHEN 'engine' THEN 5 WHEN 'foundry' THEN 10 WHEN 'enterprise' THEN 2147483647 ELSE 1 END
  ) END;
$$;
REVOKE ALL ON FUNCTION public.site_member_has_access_seat(uuid) FROM PUBLIC, anon, authenticated, service_role;

DO $access_readers$
DECLARE signature regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY['public.current_user_site_role(uuid)'::regprocedure,
    'public.site_user_has_effective_access(uuid,uuid)'::regprocedure] LOOP
    EXECUTE replace(pg_get_functiondef(signature),
      'public.site_member_has_effective_license(', 'public.site_member_has_access_seat(');
  END LOOP;
END;
$access_readers$;

CREATE FUNCTION public.stripe_late_renewal_paid_through(p_site_id uuid,p_customer_id text,p_subscription_id text)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
  SELECT a.period_end FROM public.billing b
  JOIN public.sites s ON s.id=b.site_id AND s.archived_at IS NULL
  CROSS JOIN LATERAL public.bound_stripe_late_renewal_access(
    b.site_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.subscription_end_date) a
  WHERE b.site_id=p_site_id AND b.stripe_customer_id=p_customer_id AND b.stripe_subscription_id=p_subscription_id
    AND b.status='active' AND b.subscription_status='canceled' AND b.auto_renew IS FALSE;
$$;

-- The fresh selector must not trust a persisted license_suspended mirror:
-- expiry is wall-clock driven and does not execute a database write.
CREATE FUNCTION public.list_effective_selector_memberships(p_user_id uuid)
RETURNS TABLE(id uuid,site_id uuid) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
  SELECT m.id,m.site_id FROM public.site_members m
  WHERE m.user_id=p_user_id AND m.status='active'
    AND public.site_member_has_access_seat(m.id);
$$;

CREATE FUNCTION public.record_stripe_late_renewal_access(p_evidence jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off SET timezone = 'UTC' AS $$
DECLARE
  v_site uuid;
  v_invoice text := p_evidence->>'invoice_id';
  v_customer text := p_evidence->>'customer_id';
  v_subscription text := p_evidence->>'subscription_id';
  v_charge text := p_evidence->>'charge_id';
  v_intent text := p_evidence->>'payment_intent_id';
  v_plan text := p_evidence->>'plan';
  v_addons integer;
  v_start timestamptz; v_end timestamptz; v_paid timestamptz; v_ended timestamptz;
  v_minor numeric; v_now timestamptz; v_start_utc timestamp; v_end_utc timestamp;
  v_next_last timestamp;
  b public.billing%ROWTYPE;
  s public.stripe_subscription_invoice_settlements%ROWTYPE;
  a public.stripe_late_renewal_access%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
    OR p_evidence->>'cancellation_reason' IS DISTINCT FROM 'payment_failed'
    OR p_evidence->>'billing_interval' IS DISTINCT FROM 'month'
    OR upper(p_evidence->>'currency') IS DISTINCT FROM 'USD'
    OR NOT coalesce(v_invoice ~ '^in_[A-Za-z0-9]+$' AND v_customer ~ '^cus_[A-Za-z0-9]+$'
      AND v_subscription ~ '^sub_[A-Za-z0-9]+$' AND v_charge ~ '^ch_[A-Za-z0-9]+$'
      AND v_intent ~ '^pi_[A-Za-z0-9]+$' AND v_plan IN ('engine','foundry','enterprise'),false)
    OR NOT coalesce((p_evidence->>'addons_count') ~ '^[0-9]{1,3}$'
      AND (p_evidence->>'amount_paid') ~ '^[1-9][0-9]{0,8}$',false)
  THEN RETURN 'rejected'; END IF;

  BEGIN
    v_site := (p_evidence->>'site_id')::uuid;
    v_addons := (p_evidence->>'addons_count')::integer;
    v_minor := (p_evidence->>'amount_paid')::numeric;
    v_start := (p_evidence->>'period_start')::timestamptz;
    v_end := (p_evidence->>'period_end')::timestamptz;
    v_paid := (p_evidence->>'paid_at')::timestamptz;
    v_ended := (p_evidence->>'ended_at')::timestamptz;
  EXCEPTION WHEN data_exception THEN RETURN 'rejected';
  END;
  IF v_site IS NULL OR v_addons > 100 OR NOT coalesce(
    isfinite(v_start) AND isfinite(v_end) AND isfinite(v_paid) AND isfinite(v_ended)
    AND v_start <= v_ended AND v_ended <= v_paid AND v_paid < v_end
    AND v_end - v_start <= interval '31 days',false) THEN RETURN 'rejected'; END IF;

  v_start_utc := v_start AT TIME ZONE 'UTC'; v_end_utc := v_end AT TIME ZONE 'UTC';
  v_next_last := date_trunc('month',v_start_utc) + interval '2 months' - interval '1 day';
  -- A month-end renewal can return to its original anchor after February.
  IF v_end_utc <> v_start_utc + interval '1 month' AND NOT (
    date_trunc('day',v_start_utc) = date_trunc('month',v_start_utc) + interval '1 month' - interval '1 day'
    AND v_end_utc BETWEEN v_start_utc + interval '1 month'
      AND v_next_last + (v_start_utc - date_trunc('day',v_start_utc))
    AND v_start_utc::time = v_end_utc::time
  ) THEN RETURN 'rejected'; END IF;

  -- Serialize with reversals (even before a row exists), then with canonical
  -- settlement and subscription rebinding. Recheck wall time after locking.
  PERFORM pg_advisory_xact_lock(hashtextextended('stripe-late-renewal-charge:' || v_charge,0));
  IF EXISTS (SELECT 1 FROM public.stripe_late_renewal_reversals WHERE charge_id=v_charge) THEN RETURN 'reversed'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=v_site FOR UPDATE;
  IF NOT FOUND OR b.stripe_customer_id IS DISTINCT FROM v_customer
    OR b.stripe_subscription_id IS DISTINCT FROM v_subscription
    OR b.subscription_status IS DISTINCT FROM 'canceled' OR b.auto_renew IS DISTINCT FROM false
    OR b.status IS DISTINCT FROM 'active' OR b.subscription_end_date IS DISTINCT FROM v_ended
    OR EXISTS (SELECT 1 FROM public.site_retired_stripe_subscriptions WHERE site_id=v_site AND subscription_id=v_subscription)
  THEN RETURN 'rejected'; END IF;
  PERFORM public.lock_site_license(v_site);
  v_now := clock_timestamp();
  IF v_paid > v_now OR v_end <= v_now OR NOT EXISTS (
    SELECT 1 FROM public.sites WHERE id=v_site AND archived_at IS NULL
  ) THEN RETURN 'rejected'; END IF;

  SELECT * INTO s FROM public.stripe_subscription_invoice_settlements WHERE invoice_id=v_invoice;
  IF NOT FOUND OR s.site_id IS DISTINCT FROM v_site OR s.customer_id IS DISTINCT FROM v_customer
    OR s.subscription_id IS DISTINCT FROM v_subscription OR s.amount IS DISTINCT FROM v_minor / 100
    OR s.currency IS DISTINCT FROM 'USD' OR s.credit_coverage_applied IS DISTINCT FROM false
    OR NOT coalesce(s.verified_credit_coverage @> jsonb_build_object(
      'site_id',v_site,'invoice_id',v_invoice,'subscription_id',v_subscription,
      'plan',v_plan,'addons_count',v_addons,'billing_interval','month',
      'coverage_verified',true,'billing_reason','subscription_cycle'),false)
    OR (s.verified_credit_coverage->>'period_start')::timestamptz IS DISTINCT FROM v_start
    OR (s.verified_credit_coverage->>'period_end')::timestamptz IS DISTINCT FROM v_end
    OR (s.verified_credit_coverage->>'paid_at')::timestamptz IS DISTINCT FROM v_paid
    OR NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.id=s.payment_id AND p.site_id=v_site
      AND p.transaction_id='stripe_invoice_' || v_invoice AND p.transaction_type='subscription'
      AND p.payment_method='stripe' AND p.status='completed' AND p.currency=s.currency AND p.amount=s.amount
      AND p.details @> jsonb_build_object('stripe_payment_intent_id',v_intent,'credit_outcome','terminal_subscription'))
  THEN RETURN 'rejected'; END IF;

  INSERT INTO public.stripe_late_renewal_access(invoice_id,site_id,billing_id,customer_id,subscription_id,
    charge_id,payment_intent_id,plan,period_start,period_end,ended_at,paid_at)
    VALUES(v_invoice,v_site,b.id,v_customer,v_subscription,v_charge,v_intent,v_plan,v_start,v_end,v_ended,v_paid)
    ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO a FROM public.stripe_late_renewal_access WHERE invoice_id=v_invoice;
    IF FOUND AND ROW(a.site_id,a.billing_id,a.customer_id,a.subscription_id,a.charge_id,a.payment_intent_id,
      a.plan,a.period_start,a.period_end,a.ended_at,a.paid_at) IS NOT DISTINCT FROM
      ROW(v_site,b.id,v_customer,v_subscription,v_charge,v_intent,v_plan,v_start,v_end,v_ended,v_paid)
    THEN RETURN 'duplicate'; END IF;
    RETURN 'rejected';
  END IF;
  RETURN 'granted';
END;
$$;

CREATE FUNCTION public.revoke_stripe_late_renewal_access(p_charge_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
BEGIN
  IF NOT coalesce(p_charge_id ~ '^ch_[A-Za-z0-9]+$',false) THEN RETURN 'rejected'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('stripe-late-renewal-charge:' || p_charge_id,0));
  INSERT INTO public.stripe_late_renewal_reversals VALUES(p_charge_id) ON CONFLICT DO NOTHING;
  RETURN 'revoked';
END;
$$;

REVOKE ALL ON FUNCTION public.record_stripe_late_renewal_access(jsonb),
  public.revoke_stripe_late_renewal_access(text),public.stripe_late_renewal_paid_through(uuid,text,text),
  public.list_effective_selector_memberships(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_late_renewal_access(jsonb),
  public.revoke_stripe_late_renewal_access(text),public.stripe_late_renewal_paid_through(uuid,text,text),
  public.list_effective_selector_memberships(uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;