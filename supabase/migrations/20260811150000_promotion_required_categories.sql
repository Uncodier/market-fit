-- Required categories as consumption conditions for promotions

CREATE TABLE IF NOT EXISTS public.promotion_required_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  catalog_category_id uuid NOT NULL REFERENCES public.catalog_categories(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  UNIQUE (promotion_id, catalog_category_id)
);

COMMENT ON TABLE public.promotion_required_categories IS
  'Categories the cart must include (by quantity) for the promotion to apply.';

CREATE INDEX IF NOT EXISTS idx_promotion_required_categories_promotion_id
  ON public.promotion_required_categories (promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_required_categories_site_id
  ON public.promotion_required_categories (site_id);

ALTER TABLE public.promotion_required_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "promotion_required_categories_unified" ON public.promotion_required_categories;

  CREATE POLICY "promotion_required_categories_unified" ON public.promotion_required_categories
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role' OR
    (auth.jwt() ->> 'role') = 'service_role' OR
    (
      EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.id = promotion_required_categories.site_id AND (
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

-- Clarify that required_items_mode also covers required categories
COMMENT ON COLUMN public.promotions.required_items_mode IS
  'How required products/categories are evaluated: all = every requirement, any = at least one.';
