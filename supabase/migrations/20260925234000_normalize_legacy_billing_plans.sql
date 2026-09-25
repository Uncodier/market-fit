-- Keep stored billing plans aligned with the names consumed by the deployed
-- webhook and billing limits. The earlier rename migration was not present in
-- the remote migration history, leaving active subscriptions on legacy names.
--
-- Rollback is intentionally omitted because the new names are canonical and
-- cannot be distinguished from records created after the rename.

BEGIN;

UPDATE public.billing
SET plan = CASE plan
  WHEN 'starter' THEN 'engine'
  WHEN 'startup' THEN 'foundry'
END,
updated_at = now()
WHERE plan IN ('starter', 'startup');

-- The first delivery of this renewal inserted its payment before failing on
-- the missing addons_count column. A normal retry therefore exits at the
-- duplicate-payment guard without granting the Foundry renewal credits.
DO $recovery$
DECLARE
  v_site_id constant uuid := '9be0a6a2-5567-41bf-ad06-cb4014f0faf2'::uuid;
  v_invoice_id constant text := 'in_1UJKZIIFbIhqNGTbSRcVDdHp';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE site_id = v_site_id
      AND details ->> 'stripe_invoice_id' = v_invoice_id
      AND status = 'completed'
      AND details ->> 'billing_reason' = 'subscription_cycle'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.credit_transactions
    WHERE site_id = v_site_id
      AND metadata ->> 'stripe_invoice_id' = v_invoice_id
      AND transaction_type = 'subscription_renewal_recovery'
  ) THEN
    UPDATE public.billing
    SET credits_available = coalesce(credits_available, 0) + 100,
        updated_at = now()
    WHERE site_id = v_site_id
      AND plan = 'foundry';

    IF FOUND THEN
      INSERT INTO public.credit_transactions (
        site_id,
        amount,
        transaction_type,
        description,
        metadata
      ) VALUES (
        v_site_id,
        100,
        'subscription_renewal_recovery',
        'Credits recovered after addons_count schema repair',
        jsonb_build_object(
          'stripe_invoice_id', v_invoice_id,
          'stripe_event_id', 'evt_1UJLW7IFbIhqNGTbuZpVZ9we'
        )
      );
    END IF;
  END IF;
END
$recovery$;

COMMIT;