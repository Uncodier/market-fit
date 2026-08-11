-- Public share token for guest quote review (no account required).
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS public_access_token text;

CREATE UNIQUE INDEX IF NOT EXISTS quotations_public_access_token_uidx
  ON public.quotations (public_access_token)
  WHERE public_access_token IS NOT NULL;

-- Ensure PostgREST picks up the new column immediately.
NOTIFY pgrst, 'reload schema';
