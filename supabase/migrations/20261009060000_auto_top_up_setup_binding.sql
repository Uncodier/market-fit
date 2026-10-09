BEGIN;
SET LOCAL lock_timeout = '5s';

-- One latest card setup per site. Old/completed Checkout deliveries cannot replace
-- a newer card, resume a disabled feature, or reuse another billing customer.
CREATE TABLE public.credit_auto_top_up_card_setups (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id),
  token uuid NOT NULL UNIQUE,
  actor_id uuid NOT NULL,
  stripe_customer_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','completed')),
  stripe_payment_method_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.credit_auto_top_up_card_setups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.credit_auto_top_up_card_setups FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.credit_auto_top_up_card_setups TO service_role;

ALTER FUNCTION public.attach_credit_auto_top_up_payment_method(uuid,text,text)
  RENAME TO attach_credit_auto_top_up_payment_method_internal;
REVOKE ALL ON FUNCTION public.attach_credit_auto_top_up_payment_method_internal(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.begin_credit_auto_top_up_setup(p_site_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; v_token uuid := gen_random_uuid();
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Authenticated actor required'; END IF;
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR b.stripe_customer_id IS NULL THEN RAISE EXCEPTION 'Billing customer required'; END IF;
  UPDATE public.credit_auto_top_up_settings SET enabled=false WHERE site_id=p_site_id;
  INSERT INTO public.credit_auto_top_up_card_setups(site_id,token,actor_id,stripe_customer_id,status)
    VALUES(p_site_id,v_token,p_actor_id,b.stripe_customer_id,'pending')
  ON CONFLICT(site_id) DO UPDATE SET token=excluded.token,actor_id=excluded.actor_id,
    stripe_customer_id=excluded.stripe_customer_id,status='pending',stripe_payment_method_id=NULL,
    created_at=now(),completed_at=NULL;
  RETURN jsonb_build_object('outcome','started','token',v_token,'stripe_customer_id',b.stripe_customer_id);
END;
$$;

CREATE FUNCTION public.complete_credit_auto_top_up_setup(
  p_site_id uuid,p_token uuid,p_stripe_customer_id text,p_stripe_payment_method_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.billing%ROWTYPE; s public.credit_auto_top_up_card_setups%ROWTYPE;
BEGIN
  PERFORM public.assert_credit_auto_top_up_service_role();
  SELECT * INTO b FROM public.billing WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing unavailable'; END IF;
  SELECT * INTO s FROM public.credit_auto_top_up_card_setups WHERE site_id=p_site_id FOR UPDATE;
  IF NOT FOUND OR s.token IS DISTINCT FROM p_token THEN
    RETURN jsonb_build_object('outcome','obsolete');
  END IF;
  IF b.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id OR s.stripe_customer_id IS DISTINCT FROM p_stripe_customer_id
    OR p_stripe_payment_method_id IS NULL OR p_stripe_payment_method_id !~ '^pm_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'Setup customer mismatch';
  END IF;
  IF s.status='completed' THEN
    IF s.stripe_payment_method_id IS DISTINCT FROM p_stripe_payment_method_id THEN RAISE EXCEPTION 'Setup identity conflict'; END IF;
    RETURN jsonb_build_object('outcome','duplicate');
  END IF;
  UPDATE public.credit_auto_top_up_card_setups SET status='completed',stripe_payment_method_id=p_stripe_payment_method_id,
    completed_at=now() WHERE site_id=p_site_id;
  PERFORM public.attach_credit_auto_top_up_payment_method_internal(p_site_id,p_stripe_payment_method_id,p_stripe_customer_id);
  -- Card authorization is NOT authorization to activate automatic purchases.
  UPDATE public.credit_auto_top_up_settings SET enabled=false WHERE site_id=p_site_id;
  RETURN jsonb_build_object('outcome','attached');
END;
$$;

CREATE FUNCTION public.guard_credit_auto_top_up_card_binding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.enabled AND NOT EXISTS (
    SELECT 1 FROM public.credit_auto_top_up_card_setups s JOIN public.billing b ON b.site_id=s.site_id
    WHERE s.site_id=NEW.site_id AND s.status='completed'
      AND s.stripe_customer_id=b.stripe_customer_id AND s.stripe_payment_method_id=NEW.stripe_payment_method_id
  ) THEN RAISE EXCEPTION 'Complete the latest card setup before enabling automatic top-up'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER credit_auto_top_up_card_binding BEFORE INSERT OR UPDATE ON public.credit_auto_top_up_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_credit_auto_top_up_card_binding();

-- Previous registrations lack a latest-setup proof. Require new explicit setup
-- and consent rather than silently migrating them into unattended charges.
UPDATE public.credit_auto_top_up_settings SET enabled=false;
REVOKE ALL ON FUNCTION public.begin_credit_auto_top_up_setup(uuid,uuid),
  public.complete_credit_auto_top_up_setup(uuid,uuid,text,text),public.guard_credit_auto_top_up_card_binding()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_credit_auto_top_up_setup(uuid,uuid),
  public.complete_credit_auto_top_up_setup(uuid,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
