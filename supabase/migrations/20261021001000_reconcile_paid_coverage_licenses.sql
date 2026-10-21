BEGIN;
SET LOCAL lock_timeout = '5s';

-- Dynamic trial licensing made paid coverage part of the effective plan. Keep
-- persisted resource/member mirrors in sync even when the stored tier is unchanged.
DO $$
BEGIN
  IF to_regprocedure('public.billing_license_changed()') IS NULL
    OR to_regprocedure('public.effective_site_plan(uuid)') IS NULL
    OR to_regprocedure('public.reconcile_site_member_license(uuid)') IS NULL
    OR to_regprocedure('public.lock_site_license(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Paid coverage reconciliation requires installed site and trial licensing';
  END IF;
END;
$$;

-- Replacing the existing function preserves its owner, ACLs and trigger bindings.
CREATE OR REPLACE FUNCTION public.billing_license_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_site_id uuid;
BEGIN
  target_site_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.site_id ELSE NEW.site_id END;
  PERFORM public.lock_site_license(target_site_id);
  IF TG_WHEN = 'AFTER' THEN
    -- Usage-only writes and identical provider retries must not rewrite settings.
    -- Include every billing input used by effective_site_plan and the add-on pool.
    IF TG_OP = 'UPDATE' AND ROW(
      NEW.plan,NEW.addons_count,NEW.status,NEW.stripe_subscription_id,NEW.subscription_status,
      NEW.paid_subscription_invoice_id,NEW.paid_subscription_period_start,NEW.paid_subscription_period_end,
      NEW.trial_started_at,NEW.trial_ends_at,NEW.trial_converted_at
    ) IS NOT DISTINCT FROM ROW(
      OLD.plan,OLD.addons_count,OLD.status,OLD.stripe_subscription_id,OLD.subscription_status,
      OLD.paid_subscription_invoice_id,OLD.paid_subscription_period_start,OLD.paid_subscription_period_end,
      OLD.trial_started_at,OLD.trial_ends_at,OLD.trial_converted_at
    ) THEN RETURN NULL; END IF;
    PERFORM public.reconcile_site_member_license(target_site_id);
    UPDATE public.settings SET social_media = social_media,channels = channels WHERE settings.site_id = target_site_id;
    RETURN NULL;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.site_id IS DISTINCT FROM OLD.site_id THEN RAISE EXCEPTION 'Billing site is immutable'; END IF;
  RETURN NEW;
END;
$$;

-- No backfill: this migration cannot verify legacy Stripe invoices or grant
-- missing coverage. Existing accounts require explicitly authorized recovery.
COMMIT;