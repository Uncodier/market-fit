-- Content-Assets many-to-many: link assets to content with optional primary and order
CREATE TABLE IF NOT EXISTS public.content_assets (
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_assets_pkey PRIMARY KEY (content_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_content_assets_content_id ON public.content_assets(content_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_asset_id ON public.content_assets(asset_id);

-- Only one primary per content (optional; enforce in app or trigger)
COMMENT ON TABLE public.content_assets IS 'Many-to-many: content and assets. is_primary marks the main asset for display.';
