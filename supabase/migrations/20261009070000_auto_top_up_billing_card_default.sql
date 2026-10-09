BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.credit_auto_top_up_card_setups ADD COLUMN source text NOT NULL DEFAULT 'top_up'
  CHECK(source IN ('billing','top_up'));
-- New explicit card setup overrides a previous default-card registration.
CREATE FUNCTION public.reset_credit_auto_top_up_card_source()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.status='pending' THEN NEW.source := 'top_up'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER credit_auto_top_up_card_source BEFORE INSERT OR UPDATE ON public.credit_auto_top_up_card_setups
FOR EACH ROW EXECUTE FUNCTION public.reset_credit_auto_top_up_card_source();

-- Service verifies the attached principal Stripe card first. Registration and
-- explicit opt-in are ONE transaction, fenced against concurrent setup changes.
CREATE FUNCTION public.save_credit_auto_top_up_with_billing_card(
  p_site_id uuid,p_actor_id uuid,p_stripe_customer_id text,p_stripe_payment_method_id text,
  p_expected_setup_token uuid,p_minimum_credits numeric,p_target_credits numeric,p_max_monthly_spend_cents integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_card_setups%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_actor_id IS NULL OR p_stripe_payment_method_id IS NULL OR p_stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'Verified actor and billing card required';
  END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR b.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id THEN RAISE EXCEPTION 'Billing customer changed'; END IF;
  SELECT * INTO s FROM public.credit_auto_top_up_card_setups WHERE site_id=p_site_id FOR UPDATE;
  IF s.token IS DISTINCT FROM p_expected_setup_token OR s.status='pending' THEN RAISE EXCEPTION 'Card setup changed'; END IF;
  IF s.status='completed' AND s.source='top_up' THEN RAISE EXCEPTION 'Explicit top-up card must be retained'; END IF;
  IF EXISTS(SELECT 1 FROM public.credit_auto_top_up_attempts WHERE site_id=p_site_id AND status='pending') THEN
    RAISE EXCEPTION 'Pending top-up requires reconciliation';
  END IF;
  INSERT INTO public.credit_auto_top_up_card_setups(site_id,token,actor_id,stripe_customer_id,status,stripe_payment_method_id,completed_at,source)
    VALUES(p_site_id,gen_random_uuid(),p_actor_id,p_stripe_customer_id,'completed',p_stripe_payment_method_id,now(),'billing')
  ON CONFLICT(site_id) DO UPDATE SET token=excluded.token,actor_id=excluded.actor_id,stripe_customer_id=excluded.stripe_customer_id,
    status='completed',stripe_payment_method_id=excluded.stripe_payment_method_id,completed_at=now(),source='billing';
  -- Disable only inside this transaction before rebinding; an enabled setting
  -- still points at its former card until the private attach finishes.
  UPDATE public.credit_auto_top_up_settings SET enabled=false WHERE site_id=p_site_id;
  PERFORM public.attach_credit_auto_top_up_payment_method_internal(p_site_id,p_stripe_payment_method_id,p_stripe_customer_id);
  RETURN public.set_credit_auto_top_up_settings(p_site_id,true,p_minimum_credits,p_target_credits,p_max_monthly_spend_cents,p_actor_id);
END;
$$;
REVOKE ALL ON FUNCTION public.reset_credit_auto_top_up_card_source(),
 public.save_credit_auto_top_up_with_billing_card(uuid,uuid,text,text,uuid,numeric,numeric,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_credit_auto_top_up_with_billing_card(uuid,uuid,text,text,uuid,numeric,numeric,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
