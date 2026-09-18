-- Make public document links unique and independently revocable/expirable.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS public_access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_access_token_revoked_at timestamptz;

ALTER TABLE public.sale_orders
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS public_access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_access_token_revoked_at timestamptz;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS public_access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_access_token_revoked_at timestamptz;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS public_access_token text,
  ADD COLUMN IF NOT EXISTS public_access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_access_token_revoked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS quotations_public_access_token_unique
  ON public.quotations (public_access_token)
  WHERE public_access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sale_orders_public_access_token_unique
  ON public.sale_orders (public_access_token)
  WHERE public_access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sales_public_access_token_unique
  ON public.sales (public_access_token)
  WHERE public_access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_public_access_token_unique
  ON public.purchases (public_access_token)
  WHERE public_access_token IS NOT NULL;
