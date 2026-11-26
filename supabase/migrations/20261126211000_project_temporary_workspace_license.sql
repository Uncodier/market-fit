BEGIN;
SET LOCAL lock_timeout = '5s';

-- PostgREST computed field on the existing RLS billing read. Never use fields
-- from the supplied composite as evidence: fetch the current binding by site.
CREATE FUNCTION public.temporary_workspace_license(p_row public.billing)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp SET row_security = off AS $$
  SELECT jsonb_build_object('plan',a.plan,'ends_at',public.late_payment_access_end(a))
  FROM public.billing b JOIN public.sites s ON s.id=b.site_id AND s.archived_at IS NULL
  CROSS JOIN LATERAL public.bound_stripe_late_renewal_access(
    b.site_id,b.id,b.stripe_customer_id,b.stripe_subscription_id,b.subscription_end_date) a
  JOIN public.late_payment_workspace_licenses l USING (invoice_id)
  WHERE auth.uid() IS NOT NULL AND b.site_id=p_row.site_id
    AND public.current_user_site_role(b.site_id) IS NOT NULL
    AND public.current_user_has_site_location_restrictions(b.site_id) IS FALSE
    AND b.status='active' AND b.subscription_status='canceled' AND b.auto_renew IS FALSE
    AND a.paid_at <= statement_timestamp() AND public.late_payment_access_end(a) > clock_timestamp()
    AND public.effective_site_plan(b.site_id)=a.plan;
$$;
REVOKE ALL ON FUNCTION public.temporary_workspace_license(public.billing) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.temporary_workspace_license(public.billing) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;