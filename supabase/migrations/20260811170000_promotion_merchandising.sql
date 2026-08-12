-- Promotion merchandising: image + storefront show flags

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS show_on_shop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_on_marketplace boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.promotions.image_url IS
  'Optional merchandising image (upload or AI-generated) for shop/marketplace cards.';

COMMENT ON COLUMN public.promotions.show_on_shop IS
  'When true, eligible for shop merchandising (carousel / category cards / product flags).';

COMMENT ON COLUMN public.promotions.show_on_marketplace IS
  'When true, eligible for marketplace Discounts feed and product flags.';
