-- BOGO / Buy X Get Y discount type for promotions

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_discount_type_check;

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_discount_type_check
  CHECK (discount_type = ANY (ARRAY['percent'::text, 'fixed'::text, 'bogo'::text]));

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS bogo_buy_qty integer NOT NULL DEFAULT 1
    CHECK (bogo_buy_qty >= 1);

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS bogo_get_qty integer NOT NULL DEFAULT 1
    CHECK (bogo_get_qty >= 1);
