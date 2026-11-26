BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;

-- Private, append-only grant history. Neither checkout nor financial writers
-- consume this ledger. Site-wide limits survive subscription replacements.
CREATE TABLE public.site_emergency_workspace_licenses (
  site_id uuid NOT NULL REFERENCES public.sites(id),
  billing_id uuid NOT NULL,
  customer_id text NOT NULL,
  subscription_id text NOT NULL,
  prior_invoice_id text NOT NULL REFERENCES public.stripe_subscription_invoice_settlements(invoice_id),
  requested_by uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('engine','foundry','enterprise')),
  cycle_start timestamptz NOT NULL,
  cycle_end timestamptz NOT NULL,
  granted_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  PRIMARY KEY (site_id,cycle_start),
  CHECK (isfinite(cycle_start) AND isfinite(cycle_end) AND isfinite(granted_at) AND isfinite(ends_at)
    AND cycle_end - cycle_start BETWEEN interval '28 days' AND interval '31 days'
    AND cycle_start <= granted_at AND granted_at < ends_at
    AND ends_at = least(granted_at + interval '120 hours',cycle_end))
);
CREATE INDEX site_emergency_workspace_licenses_history_idx
  ON public.site_emergency_workspace_licenses (site_id,granted_at DESC);
ALTER TABLE public.site_emergency_workspace_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_emergency_workspace_licenses FROM PUBLIC, anon, authenticated, service_role;

-- Paid evidence is checked in the settlement ledger, not just the billing
-- mirror: payment may have been recorded without applying credit coverage.
-- Unknown coverage recorded during this cycle is not proof it is unpaid.
CREATE FUNCTION public.emergency_workspace_cycle_unpaid(b public.billing)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.stripe_subscription_invoice_settlements i
    WHERE i.site_id=b.site_id AND i.customer_id=b.stripe_customer_id AND i.subscription_id=b.stripe_subscription_id
      AND i.invoice_id<>b.paid_subscription_invoice_id
      AND CASE WHEN i.verified_credit_coverage->>'period_end' IS NULL
          OR i.verified_credit_coverage->>'period_start' IS NULL
        THEN i.settled_at >= b.paid_subscription_period_end
        ELSE (i.verified_credit_coverage->>'period_end')::timestamptz > b.paid_subscription_period_end
          AND (i.verified_credit_coverage->>'period_start')::timestamptz < b.subscription_current_period_end
        END
  );
$$;
REVOKE ALL ON FUNCTION public.emergency_workspace_cycle_unpaid(public.billing) FROM PUBLIC, anon, authenticated, service_role;

-- Existing financial paths own retirement, lifecycle, paid coverage and billing
-- row identity. The grant cannot override any of their current decisions.
CREATE FUNCTION public.active_emergency_workspace_license(b public.billing,v_now timestamptz)
RETURNS public.site_emergency_workspace_licenses LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp AS $$
  SELECT g.* FROM public.site_emergency_workspace_licenses g
  WHERE g.site_id=b.site_id AND g.billing_id=b.id AND g.customer_id=b.stripe_customer_id
    AND g.subscription_id=b.stripe_subscription_id AND g.prior_invoice_id=b.paid_subscription_invoice_id
    AND g.cycle_start=b.paid_subscription_period_end AND g.cycle_end=b.subscription_current_period_end
    AND b.status='active' AND b.subscription_status='past_due' AND b.billing_interval='month'
    AND b.subscription_end_date IS NULL AND b.paid_subscription_plan=g.plan
    AND g.granted_at<=v_now AND g.ends_at>v_now
    AND NOT EXISTS (SELECT 1 FROM public.site_retired_stripe_subscriptions r
      WHERE r.site_id=b.site_id AND r.subscription_id=b.stripe_subscription_id)
    AND public.emergency_workspace_cycle_unpaid(b);
$$;
REVOKE ALL ON FUNCTION public.active_emergency_workspace_license(public.billing,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.grant_emergency_grace(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
DECLARE
  v_actor uuid := auth.uid();
  b public.billing%ROWTYPE;
  g public.site_emergency_workspace_licenses%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF v_actor IS NULL OR auth.jwt()->>'is_anonymous' = 'true' OR NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id=p_business_id AND s.user_id=v_actor AND s.archived_at IS NULL
  ) THEN RETURN jsonb_build_object('outcome','forbidden'); END IF;

  -- Match settlement and trial's billing -> site lock order. Recheck the
  -- owner after both locks so a simultaneous archive/transfer is decisive.
  SELECT * INTO b FROM public.billing WHERE site_id=p_business_id FOR UPDATE;
  PERFORM public.lock_site_license(p_business_id);
  IF NOT EXISTS (SELECT 1 FROM public.sites s
    WHERE s.id=p_business_id AND s.user_id=v_actor AND s.archived_at IS NULL
  ) THEN RETURN jsonb_build_object('outcome','forbidden'); END IF;

  v_now := clock_timestamp();
  IF (
    b.status='active' AND b.subscription_status='past_due' AND b.billing_interval='month'
    AND b.subscription_end_date IS NULL AND b.paid_subscription_plan IN ('engine','foundry','enterprise')
    AND b.paid_subscription_period_end <= v_now AND b.subscription_current_period_end > v_now
    AND isfinite(b.subscription_current_period_end)
    AND b.subscription_current_period_end - b.paid_subscription_period_end BETWEEN interval '28 days' AND interval '31 days'
    AND NOT EXISTS (SELECT 1 FROM public.site_retired_stripe_subscriptions r
      WHERE r.site_id=b.site_id AND r.subscription_id=b.stripe_subscription_id)
    AND EXISTS (SELECT 1 FROM public.stripe_subscription_invoice_settlements i
      WHERE i.invoice_id=b.paid_subscription_invoice_id AND i.site_id=b.site_id
        AND i.customer_id=b.stripe_customer_id AND i.subscription_id=b.stripe_subscription_id
        AND i.credit_coverage_applied AND i.verified_credit_coverage->'coverage_verified'='true'::jsonb
        AND i.verified_credit_coverage->>'billing_interval'='month'
        AND i.verified_credit_coverage->>'plan'=b.paid_subscription_plan
        AND (i.verified_credit_coverage->>'period_start')::timestamptz=b.paid_subscription_period_start
        AND (i.verified_credit_coverage->>'period_end')::timestamptz=b.paid_subscription_period_end
        AND (i.verified_credit_coverage->>'paid_at')::timestamptz=b.paid_subscription_paid_at
        AND b.paid_subscription_paid_at <= v_now)
    AND public.emergency_workspace_cycle_unpaid(b)
  ) IS DISTINCT FROM true THEN RETURN jsonb_build_object('outcome','ineligible'); END IF;

  SELECT * INTO g FROM public.active_emergency_workspace_license(b,v_now);
  IF g.site_id IS NOT NULL THEN
    RETURN jsonb_build_object('outcome','already_granted','plan',g.plan,'ends_at',g.ends_at);
  END IF;
  IF public.effective_site_plan(p_business_id)<>'commission' OR EXISTS (
    SELECT 1 FROM public.site_emergency_workspace_licenses existing
    WHERE existing.site_id=p_business_id AND existing.cycle_start < b.subscription_current_period_end
      AND existing.cycle_end > b.paid_subscription_period_end
  ) THEN RETURN jsonb_build_object('outcome','ineligible'); END IF;
  IF (SELECT count(*) FROM public.site_emergency_workspace_licenses existing
    WHERE existing.site_id=p_business_id
      AND existing.granted_at > ((v_now AT TIME ZONE 'UTC') - interval '12 months') AT TIME ZONE 'UTC'
  ) >= 3 THEN RETURN jsonb_build_object('outcome','limit_reached'); END IF;

  INSERT INTO public.site_emergency_workspace_licenses
    (site_id,billing_id,customer_id,subscription_id,prior_invoice_id,requested_by,plan,cycle_start,cycle_end,granted_at,ends_at)
  VALUES (p_business_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.paid_subscription_invoice_id,v_actor,
    b.paid_subscription_plan,b.paid_subscription_period_end,b.subscription_current_period_end,v_now,
    least(v_now + interval '120 hours',b.subscription_current_period_end)) RETURNING * INTO g;

  PERFORM public.reconcile_site_member_license(p_business_id);
  UPDATE public.settings SET social_media=social_media,channels=channels WHERE site_id=p_business_id;
  RETURN jsonb_build_object('outcome','granted','plan',g.plan,'ends_at',g.ends_at);
END;
$$;
REVOKE ALL ON FUNCTION public.grant_emergency_grace(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_emergency_grace(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.effective_site_plan(p_site_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  b public.billing%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_paid_access_plan text;
  v_grace_plan text;
BEGIN
  SELECT * INTO b FROM public.billing WHERE site_id = p_site_id;
  IF NOT FOUND THEN RETURN 'commission'; END IF;
  IF b.status IS DISTINCT FROM 'active' OR NOT EXISTS (
    SELECT 1 FROM public.sites WHERE id=p_site_id AND archived_at IS NULL
  ) THEN RETURN 'commission'; END IF;
  IF b.plan IN ('engine','foundry','enterprise') AND (
    b.stripe_subscription_id IS NULL OR (
      b.paid_subscription_invoice_id IS NOT NULL AND b.paid_subscription_period_start <= v_now
      AND b.paid_subscription_period_end > v_now
      AND lower(coalesce(b.subscription_status,'')) NOT IN ('canceled','cancelled','incomplete_expired'))
  ) THEN RETURN b.plan; END IF;

  IF b.subscription_status='canceled' AND b.auto_renew IS FALSE THEN
    SELECT a.plan INTO v_paid_access_plan
    FROM public.bound_stripe_late_renewal_access(
      b.site_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.subscription_end_date) a
    JOIN public.late_payment_workspace_licenses l USING (invoice_id)
    WHERE a.paid_at <= v_now AND a.period_start <= v_now AND public.late_payment_access_end(a) > v_now;
  END IF;
  IF v_paid_access_plan IN ('foundry','enterprise') THEN RETURN v_paid_access_plan; END IF;
  IF b.trial_started_at <= v_now AND b.trial_ends_at > v_now AND EXISTS (
    SELECT 1 FROM public.site_startup_trials t WHERE t.site_id = p_site_id
      AND t.started_at = b.trial_started_at AND t.ends_at = b.trial_ends_at AND t.converted_at IS NULL
  ) THEN RETURN 'foundry'; END IF;
  IF b.subscription_status='past_due' THEN
    SELECT g.plan INTO v_grace_plan FROM public.active_emergency_workspace_license(b,v_now) g;
  END IF;
  RETURN coalesce(v_paid_access_plan,v_grace_plan,'commission');
END;
$$;

CREATE OR REPLACE FUNCTION public.temporary_workspace_license(p_row public.billing)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
DECLARE
  b public.billing%ROWTYPE;
  v_license jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR auth.jwt()->>'is_anonymous' = 'true' THEN RETURN NULL; END IF;
  SELECT billing.* INTO b FROM public.billing billing JOIN public.sites s ON s.id=billing.site_id
    WHERE billing.site_id=p_row.site_id AND billing.status='active' AND s.archived_at IS NULL;
  IF NOT FOUND OR public.current_user_site_role(b.site_id) IS NULL OR
    public.current_user_has_site_location_restrictions(b.site_id) IS DISTINCT FROM false THEN RETURN NULL; END IF;
  IF b.subscription_status='past_due' THEN
    SELECT jsonb_build_object('kind','emergency_grace','plan',g.plan,'ends_at',g.ends_at) INTO v_license
    FROM public.active_emergency_workspace_license(b,v_now) g
    WHERE g.plan=public.effective_site_plan(b.site_id);
  ELSIF b.subscription_status='canceled' AND b.auto_renew IS FALSE THEN
    SELECT jsonb_build_object('plan',a.plan,'ends_at',public.late_payment_access_end(a)) INTO v_license
    FROM public.bound_stripe_late_renewal_access(
      b.site_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.subscription_end_date) a
    JOIN public.late_payment_workspace_licenses l USING (invoice_id)
    WHERE a.paid_at <= statement_timestamp() AND public.late_payment_access_end(a) > v_now
      AND public.effective_site_plan(b.site_id)=a.plan;
  END IF;
  RETURN v_license;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;