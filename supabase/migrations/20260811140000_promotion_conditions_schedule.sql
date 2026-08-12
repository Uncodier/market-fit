-- Promotion schedule (weekdays) + required product consumption conditions

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS active_weekdays smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_items_mode text NOT NULL DEFAULT 'all';

COMMENT ON COLUMN public.promotions.active_weekdays IS
  'Weekdays when the promotion is active (0=Sun … 6=Sat). Empty = every day.';

COMMENT ON COLUMN public.promotions.required_items_mode IS
  'How required products are evaluated: all = every item, any = at least one.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_required_items_mode_check'
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_required_items_mode_check CHECK (
        required_items_mode IN ('all', 'any')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_active_weekdays_check'
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_active_weekdays_check CHECK (
        active_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.promotion_required_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  UNIQUE (promotion_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_required_items_promotion_id
  ON public.promotion_required_items (promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_required_items_site_id
  ON public.promotion_required_items (site_id);

ALTER TABLE public.promotion_required_items ENABLE ROW LEVEL SECURITY;

-- Site-scoped access, matching promotion_catalog_items
DO $$
BEGIN
  DROP POLICY IF EXISTS "Enable read access for all users" ON public.promotion_required_items;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.promotion_required_items;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.promotion_required_items;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.promotion_required_items;
  DROP POLICY IF EXISTS "promotion_required_items_unified" ON public.promotion_required_items;

  CREATE POLICY "promotion_required_items_unified" ON public.promotion_required_items
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role' OR
    (auth.jwt() ->> 'role') = 'service_role' OR
    (
      EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id = promotion_required_items.site_id AND (
          s.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = s.id AND sm.user_id = auth.uid()
          )
        )
      )
    )
  );
END $$;
