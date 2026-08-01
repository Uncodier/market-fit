-- List existing active catalog items on the marketplace by default.
-- New installs already get the column via 20260722000000; this backfills data
-- and makes future inserts opt-in/out from an enabled default.

ALTER TABLE public.catalog_items
  ALTER COLUMN is_marketplace_listed SET DEFAULT true;

UPDATE public.catalog_items
SET is_marketplace_listed = true
WHERE status = 'active'
  AND COALESCE(is_marketplace_listed, false) = false;
