-- The Stripe subscription webhook reads this value when calculating renewal
-- credits and updates it from the add-on subscription item's quantity.
--
-- Rollback (only after deploying code that no longer reads this column):
-- ALTER TABLE public.billing DROP COLUMN addons_count;

BEGIN;

ALTER TABLE public.billing
  ADD COLUMN IF NOT EXISTS addons_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.billing.addons_count IS
  'Number of active Stripe account add-ons used for limits and renewal credits.';

COMMIT;
