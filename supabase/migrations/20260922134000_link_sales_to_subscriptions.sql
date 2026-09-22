BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS subscription_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_subscription_id_fkey'
      AND conrelid = 'public.sales'::regclass
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_subscription_id_fkey
      FOREIGN KEY (subscription_id)
      REFERENCES public.subscriptions(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS sales_site_subscription_date_idx
  ON public.sales (site_id, subscription_id, sale_date DESC)
  WHERE subscription_id IS NOT NULL;

COMMIT;
