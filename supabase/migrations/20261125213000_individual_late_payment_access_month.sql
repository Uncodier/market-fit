BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

-- Operator-only opt-in per verified invoice. No defaults, historical backfill,
-- billing writes or browser/service permissions to grant an extension.
CREATE TABLE public.late_payment_access_months (
  invoice_id text PRIMARY KEY REFERENCES public.stripe_late_renewal_access(invoice_id),
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by name NOT NULL DEFAULT session_user
);
ALTER TABLE public.late_payment_access_months ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.late_payment_access_months FROM PUBLIC, anon, authenticated, service_role;

-- Input must already have passed the existing tenant, subscription, retirement
-- and reversal checks. Preserve the original service line in financial records.
CREATE FUNCTION public.late_payment_access_end(a public.stripe_late_renewal_access)
RETURNS timestamptz LANGUAGE sql STABLE STRICT SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.late_payment_access_months m WHERE m.invoice_id=a.invoice_id)
    THEN greatest(a.period_end, ((a.paid_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC')
    ELSE a.period_end END;
$$;
REVOKE ALL ON FUNCTION public.late_payment_access_end(public.stripe_late_renewal_access)
  FROM PUBLIC, anon, authenticated, service_role;

-- Change only the service end expression inside the two reviewed readers.
DO $readers$
DECLARE r record; definition text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.site_member_has_access_seat(uuid)'::regprocedure,'f4893445e17642b8a311a543985f49e3','a.period_end > t.checked_at','public.late_payment_access_end(a) > t.checked_at'),
    ('public.stripe_late_renewal_paid_through(uuid,text,text)'::regprocedure,'6cfa887bbfb3d797927f54c6644ce060','SELECT a.period_end FROM','SELECT public.late_payment_access_end(a) FROM')
  ) v(signature,expected,original,replacement) LOOP
    SELECT pg_get_functiondef(p.oid) INTO STRICT definition FROM pg_proc p
      WHERE p.oid=r.signature AND p.proowner='postgres'::regrole AND md5(p.prosrc)=r.expected;
    IF strpos(definition,r.original)=0 THEN RAISE EXCEPTION 'Unexpected access boundary'; END IF;
    EXECUTE replace(definition,r.original,r.replacement);
  END LOOP;
END;
$readers$;
COMMIT;