-- Public share tokens + last emailed timestamp for sales, sale_orders, purchases

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS sales_public_access_token_uidx
  ON public.sales (public_access_token)
  WHERE public_access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sale_orders_public_access_token_uidx
  ON public.sale_orders (public_access_token)
  WHERE public_access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_public_access_token_uidx
  ON public.purchases (public_access_token)
  WHERE public_access_token IS NOT NULL;

NOTIFY pgrst, 'reload schema';
