CREATE TABLE IF NOT EXISTS public.calendar_blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- 'catalog_item', 'user', 'global'
  entity_id uuid, -- nullable for global
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for fast querying
CREATE INDEX idx_calendar_blocks_site_id ON public.calendar_blocks(site_id);
CREATE INDEX idx_calendar_blocks_entity_id ON public.calendar_blocks(entity_id);
CREATE INDEX idx_calendar_blocks_time_range ON public.calendar_blocks(start_time, end_time);

-- RLS
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their site's calendar blocks" ON public.calendar_blocks
  FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
      UNION
      SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their site's calendar blocks" ON public.calendar_blocks
  FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
      UNION
      SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their site's calendar blocks" ON public.calendar_blocks
  FOR UPDATE
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
      UNION
      SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their site's calendar blocks" ON public.calendar_blocks
  FOR DELETE
  USING (
    site_id IN (
      SELECT id FROM public.sites WHERE user_id = auth.uid()
      UNION
      SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
  );

-- Admin role RLS
CREATE POLICY "Super admin read calendar blocks" ON public.calendar_blocks FOR SELECT TO service_role USING (true);
CREATE POLICY "Super admin insert calendar blocks" ON public.calendar_blocks FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Super admin update calendar blocks" ON public.calendar_blocks FOR UPDATE TO service_role USING (true);
CREATE POLICY "Super admin delete calendar blocks" ON public.calendar_blocks FOR DELETE TO service_role USING (true);
