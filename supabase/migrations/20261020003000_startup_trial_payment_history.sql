BEGIN;
SET LOCAL lock_timeout = '5s';

-- One-owner eligibility is derived from trusted project ownership, never from
-- a client-provided user ID. Archived projects and refunded purchases still
-- establish that the owner has paid before. Zero-price grants do not.
CREATE FUNCTION public.site_owner_has_platform_payment(p_site_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.sites WHERE id=p_site_id;
  IF NOT FOUND OR owner_id IS NULL THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.payments p JOIN public.sites s ON s.id=p.site_id
    WHERE (s.user_id=owner_id OR s.id=p_site_id)
      AND p.transaction_type IN ('subscription','credits_purchase')
      AND p.status IN ('completed','refunded','partially_refunded')
      AND p.amount>0 AND p.amount::text NOT IN ('NaN','Infinity','-Infinity')
  ) OR EXISTS (
    SELECT 1 FROM public.stripe_subscription_invoice_settlements settlement
      JOIN public.sites s ON s.id=settlement.site_id
    WHERE (s.user_id=owner_id OR s.id=p_site_id)
      AND settlement.amount>0 AND settlement.amount::text NOT IN ('NaN','Infinity','-Infinity')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.site_owner_has_platform_payment(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Activation calls this same status function inside its owner/site/billing
-- locks. Both the offer and actual grant enforce the extra history condition.
CREATE OR REPLACE FUNCTION public.get_site_startup_trial(p_site_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE b public.billing%ROWTYPE; t public.site_startup_trials%ROWTYPE;
  owner_id uuid; v_now timestamptz := clock_timestamp(); v_state text;
BEGIN
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
      OR public.site_owner_has_platform_payment(p_site_id)
    THEN v_state := 'unavailable'; ELSE v_state := 'eligible'; END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'state',v_state,'started_at',t.started_at,'ends_at',t.ends_at,
    'credits_remaining',CASE WHEN v_state = 'active' THEN coalesce(b.trial_credits_available,0) ELSE 0 END,
    'server_now',v_now,'effective_plan',public.effective_site_plan(p_site_id),'offer_eligible',v_state='eligible');
END;
$$;
REVOKE ALL ON FUNCTION public.get_site_startup_trial(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_startup_trial(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;