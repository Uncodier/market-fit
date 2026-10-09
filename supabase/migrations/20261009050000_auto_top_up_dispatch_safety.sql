BEGIN;
SET LOCAL lock_timeout = '5s';

-- A lease transfers reconciliation work, never permission to create a payment.
ALTER TABLE public.credit_auto_top_up_settings
  ADD COLUMN settings_revision bigint NOT NULL DEFAULT 1 CHECK (settings_revision > 0);
ALTER TABLE public.credit_auto_top_up_attempts
  ADD COLUMN settings_revision bigint NOT NULL DEFAULT 0,
  ADD COLUMN dispatch_started_at timestamptz;
-- Old workers could already have sent these attempts. Absence of an ID is not
-- proof that Stripe never received the request. Roll out with workers stopped.
UPDATE public.credit_auto_top_up_attempts SET dispatch_started_at=created_at
  WHERE status='pending';
CREATE INDEX credit_auto_top_up_settled_spend
  ON public.credit_auto_top_up_attempts(site_id,finished_at) WHERE status='succeeded';

CREATE FUNCTION public.advance_credit_auto_top_up_settings_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public,pg_temp AS $$
BEGIN
  IF ROW(NEW.enabled,NEW.minimum_credits,NEW.target_credits,
      NEW.max_monthly_spend_cents,NEW.stripe_payment_method_id,NEW.state)
    IS DISTINCT FROM ROW(OLD.enabled,OLD.minimum_credits,OLD.target_credits,
      OLD.max_monthly_spend_cents,OLD.stripe_payment_method_id,OLD.state) THEN
    NEW.settings_revision := OLD.settings_revision+1;
  ELSE
    NEW.settings_revision := OLD.settings_revision;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER credit_auto_top_up_settings_revision
  BEFORE UPDATE ON public.credit_auto_top_up_settings FOR EACH ROW
  EXECUTE FUNCTION public.advance_credit_auto_top_up_settings_revision();

-- Private append-only consent history: the service verifies actor/site access.
-- No browser or service table-write grants allow rewriting prior consent.
CREATE TABLE public.credit_auto_top_up_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  actor_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  settings_revision bigint NOT NULL,
  settings_snapshot jsonb NOT NULL,
  unit_price_cents integer NOT NULL DEFAULT 100 CHECK (unit_price_cents=100)
);
CREATE INDEX credit_auto_top_up_consent_site
  ON public.credit_auto_top_up_consent_log(site_id,recorded_at DESC);
ALTER TABLE public.credit_auto_top_up_consent_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.credit_auto_top_up_consent_log FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.credit_auto_top_up_consent_log TO service_role;

CREATE FUNCTION public.record_credit_auto_top_up_consent(p_site_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_settings%ROWTYPE; v_id uuid;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Verified consent actor required'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing record not found'; END IF;
  SELECT * INTO s FROM public.credit_auto_top_up_settings WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Automatic top-up settings not found'; END IF;
  INSERT INTO public.credit_auto_top_up_consent_log(site_id,actor_id,settings_revision,settings_snapshot)
  VALUES (p_site_id,p_actor_id,s.settings_revision,
    to_jsonb(s)||jsonb_build_object('stripe_customer_id',b.stripe_customer_id,'currency','usd'))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'outcome','recorded','consent_id',v_id,
    'settings_revision',s.settings_revision);
END;
$$;

-- Keep the original validation implementation, but remove its unaudited entry
-- point. The public setter now requires an authenticated actor from the API.
ALTER FUNCTION public.set_credit_auto_top_up_settings(uuid,boolean,numeric,numeric,integer,text,text)
  RENAME TO configure_credit_auto_top_up_settings_internal;
REVOKE ALL ON FUNCTION public.configure_credit_auto_top_up_settings_internal(uuid,boolean,numeric,numeric,integer,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.set_credit_auto_top_up_settings(
  p_site_id uuid,p_enabled boolean,p_minimum_credits numeric,p_target_credits numeric,
  p_max_monthly_spend_cents integer,p_actor_id uuid,
  p_stripe_payment_method_id text DEFAULT NULL,p_state text DEFAULT 'ready')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE v_saved jsonb; v_consent jsonb;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Verified consent actor required'; END IF;
  v_saved := public.configure_credit_auto_top_up_settings_internal(p_site_id,p_enabled,
    p_minimum_credits,p_target_credits,p_max_monthly_spend_cents,p_stripe_payment_method_id,p_state);
  v_consent := public.record_credit_auto_top_up_consent(p_site_id,p_actor_id);
  RETURN v_saved||jsonb_build_object('consent_id',v_consent->'consent_id',
    'settings_revision',v_consent->'settings_revision');
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_credit_auto_top_up_attempt(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_settings%ROWTYPE;
  a public.credit_auto_top_up_attempts%ROWTYPE; v_credits integer; v_cents integer;
  v_spent bigint; v_month timestamptz; v_now timestamptz;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_site_id IS NULL THEN RAISE EXCEPTION 'Site required'; END IF;
  PERFORM public.renew_site_plan_credits(p_site_id);
  -- All charge/configuration/settlement writers serialize on billing first.
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'outcome','not_eligible'); END IF;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND status='pending' FOR UPDATE;
  SELECT * INTO s FROM public.credit_auto_top_up_settings WHERE site_id=p_site_id FOR UPDATE;
  v_now := clock_timestamp();
  IF a.id IS NOT NULL THEN
    IF a.dispatch_started_at IS NOT NULL AND a.stripe_payment_intent_id IS NULL THEN
      RETURN jsonb_build_object('success',true,'outcome','needs_reconciliation',
        'attempt_id',a.id,'dispatch_started_at',a.dispatch_started_at);
    END IF;
    -- Saved Stripe identities remain recoverable after disabling consent.
    IF a.dispatch_started_at IS NULL AND a.stripe_payment_intent_id IS NULL AND
      (s.site_id IS NULL OR NOT s.enabled OR s.state <> 'ready'
        OR s.settings_revision IS DISTINCT FROM a.settings_revision
        OR b.stripe_customer_id IS DISTINCT FROM a.stripe_customer_id
        OR s.stripe_payment_method_id IS DISTINCT FROM a.stripe_payment_method_id) THEN
      UPDATE public.credit_auto_top_up_attempts SET status='failed',finished_at=v_now WHERE id=a.id;
      RETURN jsonb_build_object('success',true,'outcome','not_eligible','reason','consent_changed','attempt_id',a.id);
    END IF;
    IF a.claim_expires_at > v_now THEN
      RETURN jsonb_build_object('success',true,'outcome','in_progress','attempt_id',a.id);
    END IF;
    UPDATE public.credit_auto_top_up_attempts SET claim_token=gen_random_uuid(),
      claim_expires_at=v_now+interval '10 minutes' WHERE id=a.id RETURNING * INTO a;
  ELSE
    IF s.site_id IS NULL OR NOT s.enabled OR s.state <> 'ready'
      OR b.status IS DISTINCT FROM 'active'
      OR NOT EXISTS (SELECT 1 FROM public.sites WHERE id=p_site_id AND archived_at IS NULL)
      OR b.stripe_customer_id IS NULL OR b.stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
      OR s.stripe_payment_method_id IS NULL OR b.credits_available >= s.minimum_credits THEN
      RETURN jsonb_build_object('success',true,'outcome','not_eligible');
    END IF;
    v_credits := ceil(s.target_credits-b.credits_available)::integer;
    IF v_credits NOT BETWEEN 1 AND 1000000 THEN
      RETURN jsonb_build_object('success',true,'outcome','not_eligible');
    END IF;
    v_cents := v_credits*100;
    v_month := date_trunc('month',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    SELECT coalesce(sum(amount_cents),0) INTO v_spent
      FROM public.credit_auto_top_up_attempts WHERE site_id=p_site_id AND
      (status='pending' OR (status='succeeded'
        AND greatest(created_at,finished_at) >= v_month
        AND greatest(created_at,finished_at) < (v_month AT TIME ZONE 'UTC'+interval '1 month') AT TIME ZONE 'UTC'));
    IF v_spent+v_cents > s.max_monthly_spend_cents THEN
      RETURN jsonb_build_object('success',true,'outcome','not_eligible','reason','monthly_cap');
    END IF;
    INSERT INTO public.credit_auto_top_up_attempts(site_id,credits,amount_cents,
      stripe_customer_id,stripe_payment_method_id,claim_expires_at,settings_revision)
    VALUES (p_site_id,v_credits,v_cents,b.stripe_customer_id,s.stripe_payment_method_id,
      v_now+interval '10 minutes',s.settings_revision) RETURNING * INTO a;
  END IF;
  RETURN jsonb_build_object('success',true,'outcome','claimed','attempt_id',a.id,
    'idempotency_key','credit-auto-top-up-'||a.id::text,
    'claim_token',a.claim_token,'claim_expires_at',a.claim_expires_at,
    'credits',a.credits,'amount_cents',a.amount_cents,
    'stripe_customer_id',a.stripe_customer_id,'stripe_payment_method_id',a.stripe_payment_method_id,
    'stripe_payment_intent_id',a.stripe_payment_intent_id,'dispatch_started_at',a.dispatch_started_at);
END;
$$;

CREATE FUNCTION public.authorize_credit_auto_top_up_dispatch(
  p_site_id uuid,p_attempt_id uuid,p_claim_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_settings%ROWTYPE;
  a public.credit_auto_top_up_attempts%ROWTYPE; v_now timestamptz;
  v_reason text; v_spent bigint; v_month timestamptz;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  PERFORM public.renew_site_plan_credits(p_site_id);
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND id=p_attempt_id FOR UPDATE;
  SELECT * INTO s FROM public.credit_auto_top_up_settings WHERE site_id=p_site_id FOR UPDATE;
  v_now := clock_timestamp();
  IF a.id IS NULL OR a.status <> 'pending' OR a.claim_token IS DISTINCT FROM p_claim_token
    OR a.claim_expires_at <= v_now OR a.dispatch_started_at IS NOT NULL
    OR a.stripe_payment_intent_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'outcome','not_authorized','reason','stale_or_dispatched',
      'attempt_id',p_attempt_id,'dispatch_started_at',a.dispatch_started_at);
  END IF;
  IF s.site_id IS NULL OR NOT s.enabled OR s.state <> 'ready'
    OR a.settings_revision IS DISTINCT FROM s.settings_revision
    OR b.stripe_customer_id IS DISTINCT FROM a.stripe_customer_id
    OR s.stripe_payment_method_id IS DISTINCT FROM a.stripe_payment_method_id THEN
    v_reason := 'consent_changed';
  ELSIF b.site_id IS NULL OR b.status IS DISTINCT FROM 'active'
    OR NOT EXISTS (SELECT 1 FROM public.sites WHERE id=p_site_id AND archived_at IS NULL)
    OR b.stripe_customer_id IS NULL OR b.stripe_customer_id !~ '^cus_[A-Za-z0-9]+$'
    OR s.stripe_payment_method_id IS NULL OR s.stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$'
    OR b.credits_available >= s.minimum_credits
    OR a.credits IS DISTINCT FROM ceil(s.target_credits-b.credits_available)::integer
    OR a.amount_cents <> a.credits*100 THEN
    v_reason := 'not_eligible';
  ELSE
    v_month := date_trunc('month',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    SELECT coalesce(sum(amount_cents),0) INTO v_spent
      FROM public.credit_auto_top_up_attempts WHERE site_id=p_site_id AND
      (status='pending' OR (status='succeeded'
        AND greatest(created_at,finished_at) >= v_month
        AND greatest(created_at,finished_at) < (v_month AT TIME ZONE 'UTC'+interval '1 month') AT TIME ZONE 'UTC'));
    IF v_spent > s.max_monthly_spend_cents THEN v_reason := 'monthly_cap'; END IF;
  END IF;
  IF v_reason IS NOT NULL THEN
    -- No external operation was authorized: release only this reservation,
    -- without pausing the user's settings or requiring a Stripe cancellation.
    UPDATE public.credit_auto_top_up_attempts SET status='failed',finished_at=v_now WHERE id=a.id;
    RETURN jsonb_build_object('success',true,'outcome','not_authorized','reason',v_reason,'attempt_id',a.id);
  END IF;
  UPDATE public.credit_auto_top_up_attempts SET dispatch_started_at=v_now WHERE id=a.id;
  RETURN jsonb_build_object('success',true,'outcome','authorized','attempt_id',a.id,
    'idempotency_key','credit-auto-top-up-'||a.id::text,
    'claim_token',a.claim_token,'claim_expires_at',a.claim_expires_at,'dispatch_started_at',v_now,
    'credits',a.credits,'amount_cents',a.amount_cents,
    'stripe_customer_id',a.stripe_customer_id,'stripe_payment_method_id',a.stripe_payment_method_id);
END;
$$;

-- Discovery never returns dispatched attempts without Stripe identity: those
-- require operator/webhook reconciliation, not another automatic creation.
-- They remain pending and visible in the private attempt table and Billing UI.
CREATE OR REPLACE FUNCTION public.list_credit_auto_top_up_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE(site_id uuid) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public,pg_temp AS $$
DECLARE v_now timestamptz := clock_timestamp(); v_month timestamptz; v_next_month timestamptz;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid automatic top-up candidate limit';
  END IF;
  v_month := date_trunc('month',v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_next_month := (v_month AT TIME ZONE 'UTC'+interval '1 month') AT TIME ZONE 'UTC';
  RETURN QUERY
  WITH eligible AS (
    SELECT s.site_id AS candidate_site_id,recent.created_at AS ordering_time
      FROM public.credit_auto_top_up_settings s
      JOIN public.billing b ON b.site_id=s.site_id
      JOIN public.sites t ON t.id=s.site_id
      CROSS JOIN LATERAL (
        SELECT b.credits_available-CASE WHEN b.plan_credit_period_end <= v_now
          OR (b.stripe_subscription_id IS NOT NULL AND b.paid_subscription_period_end <= v_now)
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
          FROM public.credit_auto_top_up_attempts spent WHERE spent.site_id=s.site_id AND
          (spent.status='pending' OR (spent.status='succeeded'
            AND greatest(spent.created_at,spent.finished_at) >= v_month
            AND greatest(spent.created_at,spent.finished_at) < v_next_month)))
          + ceil(s.target_credits-effective.balance)*100 <= s.max_monthly_spend_cents
      ORDER BY recent.created_at ASC NULLS FIRST,s.site_id LIMIT p_limit
  ), due AS (
    SELECT a.site_id AS candidate_site_id,a.claim_expires_at AS ordering_time
      FROM public.credit_auto_top_up_attempts a JOIN public.billing b ON b.site_id=a.site_id
      WHERE a.status='pending' AND a.claim_expires_at <= v_now
        AND (a.stripe_payment_intent_id IS NOT NULL OR a.dispatch_started_at IS NULL)
      ORDER BY a.claim_expires_at,a.created_at,a.site_id
      LIMIT CASE WHEN EXISTS (SELECT 1 FROM eligible)
        THEN greatest(1,(p_limit+1)/2) ELSE p_limit END
  )
  SELECT candidates.candidate_site_id FROM (
    SELECT 0 AS priority,due.candidate_site_id,due.ordering_time FROM due
    UNION ALL SELECT 1 AS priority,eligible.candidate_site_id,eligible.ordering_time FROM eligible
  ) candidates ORDER BY candidates.priority,candidates.ordering_time ASC NULLS FIRST,
    candidates.candidate_site_id LIMIT p_limit;
END;
$$;

-- Verified webhook identity recovery does not need a fresh claim lease or
-- enabled consent, but new attempts must have crossed the dispatch boundary.
CREATE OR REPLACE FUNCTION public.record_credit_auto_top_up_intent(
  p_site_id uuid,p_attempt_id uuid,p_claim_token uuid,p_stripe_payment_intent_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE a public.credit_auto_top_up_attempts%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
  THEN RAISE EXCEPTION 'Valid Stripe payment intent required'; END IF;
  PERFORM 1 FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  SELECT * INTO a FROM public.credit_auto_top_up_attempts
    WHERE site_id=p_site_id AND id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR a.status <> 'pending' OR a.claim_token IS DISTINCT FROM p_claim_token
    OR a.dispatch_started_at IS NULL
    OR (a.stripe_payment_intent_id IS NOT NULL
      AND a.stripe_payment_intent_id <> p_stripe_payment_intent_id) THEN
    RAISE EXCEPTION 'Stale, undispatched or conflicting automatic top-up intent';
  END IF;
  UPDATE public.credit_auto_top_up_attempts SET stripe_payment_intent_id=p_stripe_payment_intent_id
    WHERE id=a.id;
  RETURN jsonb_build_object('success',true,'outcome','recorded','attempt_id',a.id);
END;
$$;

REVOKE ALL ON FUNCTION public.advance_credit_auto_top_up_settings_revision(),
  public.record_credit_auto_top_up_consent(uuid,uuid),
  public.set_credit_auto_top_up_settings(uuid,boolean,numeric,numeric,integer,uuid,text,text),
  public.authorize_credit_auto_top_up_dispatch(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_credit_auto_top_up_consent(uuid,uuid),
  public.set_credit_auto_top_up_settings(uuid,boolean,numeric,numeric,integer,uuid,text,text),
  public.authorize_credit_auto_top_up_dispatch(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;