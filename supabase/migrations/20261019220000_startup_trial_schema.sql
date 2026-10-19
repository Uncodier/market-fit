BEGIN;
SET LOCAL lock_timeout = '5s';

-- Shared API prerequisites: classified buckets, annual paid coverage, exact
-- numeric accounting and actual-cost reservations through 20261014230002.
-- Version one permits only Toolbox, zero extras and no live subscription or
-- paid coverage. Bought, legacy, account and the original Free window survive.
-- Keep claims after account/site deletion: deletion must not reset eligibility.
CREATE TABLE public.site_startup_trials (
  primary_owner_id uuid PRIMARY KEY,
  site_id uuid NOT NULL UNIQUE,
  started_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  converted_at timestamptz,
  CHECK (isfinite(started_at) AND isfinite(ends_at)
    AND ends_at = started_at + interval '360 hours'),
  CHECK (converted_at IS NULL OR (isfinite(converted_at) AND converted_at >= started_at))
);
ALTER TABLE public.site_startup_trials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_startup_trials FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.site_startup_trials TO service_role;

ALTER TABLE public.billing
  ADD COLUMN trial_credits_available numeric NOT NULL DEFAULT 0,
  ADD COLUMN trial_started_at timestamptz,
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN trial_converted_at timestamptz;
ALTER TABLE public.billing DROP CONSTRAINT billing_credit_buckets_valid;
ALTER TABLE public.billing ADD CONSTRAINT billing_credit_buckets_valid CHECK (
  plan_credits_available >= 0 AND purchased_credits_available >= 0 AND legacy_credits_available >= 0
  AND trial_credits_available >= 0 AND trial_credits_available <= 50
  AND monthly_credits_used >= 0 AND plan_credits_used >= 0 AND plan_credit_allowance >= 0
  AND credits_available = plan_credits_available + purchased_credits_available + legacy_credits_available + trial_credits_available
  AND credits_available::text NOT IN ('NaN','Infinity','-Infinity')
  AND monthly_credits_used::text NOT IN ('NaN','Infinity','-Infinity')
  AND plan_credits_used::text NOT IN ('NaN','Infinity','-Infinity')
  AND plan_credit_allowance::text NOT IN ('NaN','Infinity','-Infinity')
  AND ((plan_credit_period_start IS NULL AND plan_credit_period_end IS NULL)
    OR (plan_credit_period_start IS NOT NULL AND plan_credit_period_end IS NOT NULL
      AND isfinite(plan_credit_period_start) AND isfinite(plan_credit_period_end)
      AND plan_credit_period_end > plan_credit_period_start))
  AND ((trial_started_at IS NULL AND trial_ends_at IS NULL AND trial_credits_available = 0)
    OR (trial_started_at IS NOT NULL AND trial_ends_at IS NOT NULL AND trial_ends_at = trial_started_at + interval '360 hours'
      AND isfinite(trial_started_at) AND isfinite(trial_ends_at)))
  AND (trial_converted_at IS NULL OR (isfinite(trial_converted_at) AND trial_credits_available=0))
);

-- STABLE reads are usable in RLS; wall time (not transaction start) is deliberate.
-- A long transaction cannot extend the trial or a verified paid entitlement.
CREATE FUNCTION public.effective_site_plan(p_site_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE b public.billing%ROWTYPE; v_now timestamptz := clock_timestamp();
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
  IF b.trial_started_at <= v_now AND b.trial_ends_at > v_now AND EXISTS (
    SELECT 1 FROM public.site_startup_trials t WHERE t.site_id = p_site_id
      AND t.started_at = b.trial_started_at AND t.ends_at = b.trial_ends_at AND t.converted_at IS NULL
  ) THEN RETURN 'foundry'; END IF;
  RETURN 'commission';
END;
$$;
REVOKE ALL ON FUNCTION public.effective_site_plan(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_site_plan(uuid) TO service_role;

CREATE FUNCTION public.get_site_startup_trial(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE b public.billing%ROWTYPE; t public.site_startup_trials%ROWTYPE;
  owner_id uuid; v_now timestamptz := clock_timestamp(); v_state text;
BEGIN
  -- Status reads may expire an existing grant, never create or refill one.
  -- Security still uses read-only effective plan/rank even without this cleanup.
  IF EXISTS (SELECT 1 FROM public.billing WHERE site_id=p_site_id
    AND trial_ends_at <= v_now AND trial_converted_at IS NULL) THEN
    PERFORM public.renew_site_plan_credits(p_site_id);
    PERFORM public.reconcile_site_member_license(p_site_id);
    UPDATE public.settings SET social_media=social_media,channels=channels WHERE site_id=p_site_id;
  END IF;
  v_now := clock_timestamp();
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id AND archived_at IS NULL;
  IF NOT FOUND THEN v_state := 'unavailable';
  ELSE
    SELECT * INTO b FROM public.billing WHERE site_id = p_site_id;
    SELECT * INTO t FROM public.site_startup_trials WHERE site_id = p_site_id;
    IF t.site_id IS NOT NULL THEN
      v_state := CASE WHEN t.converted_at IS NOT NULL THEN 'converted'
        WHEN v_now >= t.ends_at THEN 'expired' WHEN v_now >= t.started_at THEN 'active' ELSE 'unavailable' END;
    ELSIF b.id IS NULL OR owner_id IS NULL OR b.status IS DISTINCT FROM 'active'
      OR coalesce(b.plan,'commission') NOT IN ('commission','free','toolbox')
      OR coalesce(b.addons_count,0) <> 0
      OR (b.stripe_subscription_id IS NOT NULL AND lower(coalesce(b.subscription_status,''))
        NOT IN ('canceled','cancelled','incomplete_expired'))
      OR b.paid_subscription_period_end > v_now
      OR EXISTS (SELECT 1 FROM public.site_startup_trials WHERE primary_owner_id = owner_id)
    THEN v_state := 'unavailable'; ELSE v_state := 'eligible'; END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'state',v_state,'started_at',t.started_at,'ends_at',t.ends_at,
    'credits_remaining',CASE WHEN v_state = 'active' THEN coalesce(b.trial_credits_available,0) ELSE 0 END,
    'server_now',v_now,'effective_plan',public.effective_site_plan(p_site_id));
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_startup_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_startup_trial(uuid) TO service_role;

CREATE FUNCTION public.start_site_startup_trial(p_site_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner_id uuid; v_now timestamptz; dto jsonb;
BEGIN
  IF p_site_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Trial inputs are required'; END IF;
  SELECT user_id INTO owner_id FROM public.sites WHERE id = p_site_id AND archived_at IS NULL;
  IF NOT FOUND OR NOT (owner_id = p_actor_id OR EXISTS (
    SELECT 1 FROM public.site_members m WHERE m.site_id = p_site_id AND m.user_id = p_actor_id
      AND m.status = 'active' AND m.role IN ('owner','admin')
      AND public.site_member_has_effective_license(m.id)
  )) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A licensed site manager must start the trial'; END IF;
  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Trial activation requires READ COMMITTED or SERIALIZABLE'; END IF;
  -- Owner lock prevents simultaneous claims across projects. Billing is locked
  -- before the site, matching the existing financial writer trigger order.
  PERFORM pg_advisory_xact_lock(hashtextextended('startup-trial-owner:' || owner_id,0));
  PERFORM 1 FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
  PERFORM 1 FROM public.sites WHERE id = p_site_id AND archived_at IS NULL AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Primary ownership changed'; END IF;
  IF owner_id IS DISTINCT FROM p_actor_id AND NOT EXISTS (
    SELECT 1 FROM public.site_members m WHERE m.site_id=p_site_id AND m.user_id=p_actor_id
      AND m.status='active' AND m.role IN ('owner','admin') AND public.site_member_has_effective_license(m.id)
  ) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Manager authorization changed'; END IF;
  dto := public.get_site_startup_trial(p_site_id);
  IF EXISTS (SELECT 1 FROM public.site_startup_trials WHERE site_id = p_site_id) THEN
    RETURN dto || jsonb_build_object('outcome','already_started'); END IF;
  IF EXISTS (SELECT 1 FROM public.site_startup_trials WHERE primary_owner_id = owner_id) THEN
    RETURN dto || jsonb_build_object('outcome','already_used'); END IF;
  IF dto->>'state' <> 'eligible' THEN RETURN dto || jsonb_build_object('outcome','not_eligible'); END IF;
  v_now := clock_timestamp();
  INSERT INTO public.site_startup_trials(primary_owner_id,site_id,started_at,ends_at)
    VALUES(owner_id,p_site_id,v_now,v_now + interval '360 hours');
  UPDATE public.billing SET trial_started_at = v_now,trial_ends_at = v_now + interval '360 hours',
    trial_credits_available = 50 WHERE site_id = p_site_id;
  INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
    VALUES(p_site_id,50,'startup_trial_grant','One-time 15-day Startup trial',
      jsonb_build_object('credit_bucket','trial','ends_at',v_now + interval '360 hours'));
  PERFORM public.reconcile_site_member_license(p_site_id);
  UPDATE public.settings SET social_media = social_media,channels = channels WHERE site_id = p_site_id;
  RETURN public.get_site_startup_trial(p_site_id) || jsonb_build_object('outcome','started');
END;
$$;
REVOKE ALL ON FUNCTION public.start_site_startup_trial(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_site_startup_trial(uuid,uuid) TO service_role;

-- Runs LAST, after both shared financial guards. Every classified financial
-- writer may keep its three-bucket aggregate expression; the trigger derives
-- the four-bucket aggregate and never infers a grant from an aggregate delta.
CREATE FUNCTION public.guard_startup_trial_billing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE t public.site_startup_trials%ROWTYPE; v_now timestamptz := clock_timestamp();
  v_browser boolean := coalesce(auth.role(),'') IN ('anon','authenticated')
    OR coalesce(current_setting('role',true),'') IN ('anon','authenticated');
  v_expired numeric := 0;
BEGIN
  IF v_browser AND (TG_OP = 'INSERT' OR ROW(NEW.trial_credits_available,NEW.trial_started_at,NEW.trial_ends_at,NEW.trial_converted_at)
    IS DISTINCT FROM ROW(OLD.trial_credits_available,OLD.trial_started_at,OLD.trial_ends_at,OLD.trial_converted_at)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Trial fields are server managed'; END IF;
  SELECT * INTO t FROM public.site_startup_trials WHERE site_id = NEW.site_id;
  IF TG_OP='UPDATE' AND OLD.trial_ends_at <= v_now AND (
    (NEW.trial_credits_available < OLD.trial_credits_available AND NEW.credits_used > OLD.credits_used)
    OR NEW.trial_credits_available > OLD.trial_credits_available
  ) THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Trial expired while debit was being admitted; retry';
  END IF;
  IF NEW.trial_converted_at IS NOT NULL AND NEW.trial_converted_at IS DISTINCT FROM t.converted_at THEN
    RAISE EXCEPTION 'Trial conversion projection must match its claim'; END IF;
  IF NEW.trial_started_at IS NOT NULL AND (t.site_id IS NULL OR NEW.trial_started_at <> t.started_at
    OR NEW.trial_ends_at IS DISTINCT FROM t.ends_at) THEN
    RAISE EXCEPTION 'Trial projection must match its immutable claim'; END IF;
  IF t.site_id IS NOT NULL AND t.converted_at IS NULL AND (
    (NEW.stripe_subscription_id IS NOT NULL AND NEW.paid_subscription_invoice_id IS NOT NULL
      AND NEW.paid_subscription_period_start <= v_now AND NEW.paid_subscription_period_end > v_now
      AND (NEW.plan IN ('engine','foundry','enterprise') OR NEW.addons_count > 0))
    OR (NEW.stripe_subscription_id IS NULL AND NEW.plan IN ('engine','foundry','enterprise'))
  ) THEN
    UPDATE public.site_startup_trials SET converted_at = v_now WHERE site_id = NEW.site_id;
    t.converted_at := v_now;
  END IF;
  IF t.converted_at IS NOT NULL THEN
    v_expired := NEW.trial_credits_available;
    NEW.trial_converted_at := t.converted_at;
    NEW.trial_started_at := NULL; NEW.trial_ends_at := NULL; NEW.trial_credits_available := 0;
  ELSIF NEW.trial_ends_at <= v_now OR NEW.status IS DISTINCT FROM 'active' OR NOT EXISTS (
    SELECT 1 FROM public.sites WHERE id = NEW.site_id AND archived_at IS NULL
  ) THEN v_expired := NEW.trial_credits_available; NEW.trial_credits_available := 0; END IF;
  IF v_expired > 0 THEN
    INSERT INTO public.credit_transactions(site_id,amount,transaction_type,description,metadata)
      VALUES(NEW.site_id,-v_expired,'startup_trial_expiry','Unused Startup trial credits expired',
        jsonb_build_object('credit_bucket','trial','reason',CASE WHEN t.converted_at IS NOT NULL THEN 'converted' ELSE 'expired_or_archived' END));
  END IF;
  NEW.credits_available := NEW.plan_credits_available + NEW.purchased_credits_available
    + NEW.legacy_credits_available + NEW.trial_credits_available;
  RETURN NEW;
END;
$$;
-- Definer is needed solely for the private claim/converted transition. The
-- original financial guard still uses the real auth/SET ROLE browser boundary.
ALTER FUNCTION public.guard_startup_trial_billing() SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.guard_startup_trial_billing() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER zzzz_guard_startup_trial_billing BEFORE INSERT OR UPDATE ON public.billing
  FOR EACH ROW EXECUTE FUNCTION public.guard_startup_trial_billing();

NOTIFY pgrst, 'reload schema';
COMMIT;