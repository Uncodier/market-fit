-- Promotion channel targeting: marketplace, shop, POS (+ optional POS locations)

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT ARRAY['marketplace', 'shop', 'pos']::text[],
  ADD COLUMN IF NOT EXISTS location_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN public.promotions.channels IS
  'Sales channels where this promotion applies: marketplace, shop, pos.';

COMMENT ON COLUMN public.promotions.location_ids IS
  'POS location IDs where this promotion applies. Empty = all active locations when POS is enabled.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_channels_check'
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_channels_check CHECK (
        channels <@ ARRAY['marketplace', 'shop', 'pos']::text[]
        AND cardinality(channels) >= 1
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_channels ON public.promotions USING GIN (channels);
CREATE INDEX IF NOT EXISTS idx_promotions_location_ids ON public.promotions USING GIN (location_ids);
