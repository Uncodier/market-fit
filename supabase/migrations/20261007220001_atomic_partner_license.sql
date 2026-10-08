BEGIN;

-- Route authorization remains mandatory; the service-only RPC independently
-- validates both license ownership and the actor's current site permissions.
CREATE OR REPLACE FUNCTION public.apply_site_partner_license(p_license_key uuid,p_site_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  partner_record public.partner_licenses%ROWTYPE;
  billing_record public.billing%ROWTYPE;
  target_plan text;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.archived_at IS NULL AND (
      s.user_id = p_actor_id OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = p_actor_id AND sm.status = 'active'
          AND NOT sm.license_suspended AND (sm.role IN ('owner','admin') OR EXISTS (
            SELECT 1 FROM public.site_ownership so WHERE so.site_id = s.id AND so.user_id = p_actor_id)))
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Partner license site access denied'; END IF;
  PERFORM public.lock_site_license(p_site_id);
  -- Recheck after taking the site lock: a concurrent suspension/ownership transfer
  -- must not authorize a stale manager decision.
  IF NOT EXISTS (
    SELECT 1 FROM public.sites s WHERE s.id = p_site_id AND s.archived_at IS NULL AND (
      s.user_id = p_actor_id OR EXISTS (SELECT 1 FROM public.site_members sm
        WHERE sm.site_id = s.id AND sm.user_id = p_actor_id AND sm.status = 'active'
          AND NOT sm.license_suspended AND (sm.role IN ('owner','admin') OR EXISTS (
            SELECT 1 FROM public.site_ownership so WHERE so.site_id = s.id AND so.user_id = p_actor_id)))
    )
  ) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Partner license site access denied'; END IF;
  SELECT * INTO partner_record FROM public.partner_licenses WHERE license_key = p_license_key FOR UPDATE;
  IF NOT FOUND OR partner_record.user_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Partner license ownership denied';
  END IF;
  IF partner_record.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Partner license is not active';
  END IF;
  IF partner_record.site_id IS NOT NULL AND partner_record.site_id <> p_site_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTNER_LICENSE_LINKED';
  END IF;
  SELECT * INTO billing_record FROM public.billing WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTNER_BILLING_MISSING'; END IF;
  IF billing_record.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARTNER_STRIPE_CONFLICT';
  END IF;
  target_plan := CASE WHEN lower(coalesce(partner_record.plan_name,'')) LIKE '%foundry%'
    OR lower(coalesce(partner_record.plan_name,'')) LIKE '%tier 2%'
    OR lower(coalesce(partner_record.plan_name,'')) LIKE '%tier2%' THEN 'foundry' ELSE 'engine' END;
  UPDATE public.partner_licenses SET site_id = p_site_id WHERE id = partner_record.id AND user_id = p_actor_id;
  -- Existing financial triggers own credit bucket transitions. Never touch balances.
  UPDATE public.billing SET plan = target_plan,subscription_status = 'active',auto_renew = false,updated_at = now()
    WHERE id = billing_record.id;
  RETURN jsonb_build_object('success',true,'plan',target_plan);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_site_partner_license(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_site_partner_license(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;