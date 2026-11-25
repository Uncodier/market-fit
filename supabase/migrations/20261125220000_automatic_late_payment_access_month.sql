BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;

-- The canonical settlement RPC inserts a proof only after checking a verified
-- paid renewal, its binding, and reversal state. Enroll only newly inserted
-- proofs; a delivery retry must not upgrade historical grants or reset time.
CREATE FUNCTION public.enroll_new_late_payment_access_month()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO public.late_payment_access_months(invoice_id) VALUES (NEW.invoice_id);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.enroll_new_late_payment_access_month()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER enroll_new_late_payment_access_month
AFTER INSERT ON public.stripe_late_renewal_access
FOR EACH ROW EXECUTE FUNCTION public.enroll_new_late_payment_access_month();
COMMIT;