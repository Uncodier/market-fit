-- Price list channel targeting: which surfaces may use this list.
-- Default is POS-only so existing lists do not override shop/marketplace until enabled.

ALTER TABLE public.price_lists
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT ARRAY['pos']::text[];

COMMENT ON COLUMN public.price_lists.channels IS
  'Sales channels where this price list may apply: marketplace, shop, pos.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'price_lists_channels_check'
  ) THEN
    ALTER TABLE public.price_lists
      ADD CONSTRAINT price_lists_channels_check CHECK (
        channels <@ ARRAY['marketplace', 'shop', 'pos']::text[]
        AND cardinality(channels) >= 1
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_price_lists_channels ON public.price_lists USING GIN (channels);
