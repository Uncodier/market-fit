BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;

-- A seat extension is not approval for the full workspace tier. The database
-- operator must separately approve an existing verified invoice; no backfill.
CREATE TABLE public.late_payment_workspace_licenses (
  invoice_id text PRIMARY KEY REFERENCES public.late_payment_access_months(invoice_id),
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.late_payment_workspace_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.late_payment_workspace_licenses FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.effective_site_plan(p_site_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp SET row_security = off AS $$
DECLARE
  b public.billing%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_paid_access_plan text;
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
  RETURN coalesce(v_paid_access_plan,'commission');
END;
$$;

-- Use the ordinary license reconciliation, not manual edits to suspension
-- markers. Both event paths take the same site lock as billing/seat writers.
CREATE FUNCTION public.reconcile_late_payment_workspace_license()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
DECLARE v_site uuid;
BEGIN
  IF TG_TABLE_NAME = 'stripe_late_renewal_reversals' THEN
    SELECT a.site_id INTO v_site FROM public.stripe_late_renewal_access a
    JOIN public.late_payment_workspace_licenses l USING (invoice_id) WHERE a.charge_id=NEW.charge_id;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT a.site_id INTO STRICT v_site FROM public.stripe_late_renewal_access a WHERE a.invoice_id=NEW.invoice_id;
  ELSE
    SELECT a.site_id INTO STRICT v_site FROM public.stripe_late_renewal_access a WHERE a.invoice_id=OLD.invoice_id;
  END IF;
  IF v_site IS NULL THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME = 'late_payment_workspace_licenses' AND TG_OP = 'INSERT' THEN
    PERFORM public.lock_site_license(v_site);
    IF NOT EXISTS (
      SELECT 1 FROM public.billing b JOIN public.sites s ON s.id=b.site_id AND s.archived_at IS NULL
      CROSS JOIN LATERAL public.bound_stripe_late_renewal_access(
        b.site_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.subscription_end_date) a
      WHERE b.site_id=v_site AND a.invoice_id=NEW.invoice_id AND b.status='active'
        AND b.subscription_status='canceled' AND b.auto_renew IS FALSE
        AND a.paid_at <= clock_timestamp() AND public.late_payment_access_end(a) > clock_timestamp()
    ) THEN RAISE EXCEPTION 'Workspace license requires current verified late-payment access'; END IF;
  END IF;

  BEGIN
    PERFORM public.reconcile_site_member_license(v_site);
    UPDATE public.settings SET social_media=social_media,channels=channels WHERE site_id=v_site;
  EXCEPTION WHEN OTHERS THEN
    -- A legacy settings row or a mirror lock must not roll back a charge
    -- reversal. Authoritative readers already stop honoring the grant.
    IF TG_TABLE_NAME <> 'stripe_late_renewal_reversals' THEN RAISE; END IF;
    RAISE WARNING 'Late payment license mirrors could not be reconciled after reversal (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_late_payment_workspace_license() FROM PUBLIC, anon, authenticated, service_role;

-- Serialize approval with charge reversal before acquiring site locks. An
-- uncommitted approval cannot be missed by the reversal reconciliation.
CREATE FUNCTION public.lock_late_payment_workspace_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
DECLARE v_charge text;
BEGIN
  SELECT charge_id INTO STRICT v_charge FROM public.stripe_late_renewal_access WHERE invoice_id=NEW.invoice_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('stripe-late-renewal-charge:' || v_charge,0));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_late_payment_workspace_approval() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER lock_late_payment_workspace_approval BEFORE INSERT ON public.late_payment_workspace_licenses
FOR EACH ROW EXECUTE FUNCTION public.lock_late_payment_workspace_approval();
CREATE TRIGGER reconcile_late_payment_workspace_approval AFTER INSERT OR DELETE ON public.late_payment_workspace_licenses
FOR EACH ROW EXECUTE FUNCTION public.reconcile_late_payment_workspace_license();
CREATE TRIGGER reconcile_late_payment_workspace_reversal AFTER INSERT ON public.stripe_late_renewal_reversals
FOR EACH ROW EXECUTE FUNCTION public.reconcile_late_payment_workspace_license();
COMMIT;