ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS usage_limit_per_user integer;

COMMENT ON COLUMN public.promotions.usage_limit_per_user IS
  'Max redemptions per buyer (buyer_user_id or lead_id). NULL = unlimited.';

CREATE TABLE IF NOT EXISTS public.promotion_catalog_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  catalog_category_id uuid NOT NULL REFERENCES public.catalog_categories(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT promotion_catalog_categories_pkey PRIMARY KEY (id),
  CONSTRAINT uq_promotion_catalog_categories UNIQUE (promotion_id, catalog_category_id)
);

ALTER TABLE public.promotion_catalog_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'promotion_catalog_categories' AND policyname = 'site_members_promotion_catalog_categories'
  ) THEN
    CREATE POLICY "site_members_promotion_catalog_categories" ON public.promotion_catalog_categories
      FOR ALL
      USING (
        site_id IN (
          SELECT site_members.site_id
          FROM public.site_members
          WHERE site_members.user_id = auth.uid()
        )
      )
      WITH CHECK (
        site_id IN (
          SELECT site_members.site_id
          FROM public.site_members
          WHERE site_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;
