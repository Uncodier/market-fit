-- Promotion currency override (defaults to site currency when null)

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS currency text;

COMMENT ON COLUMN public.promotions.currency IS
  'Currency for fixed discounts and min-order amounts. Null = use site default currency.';
