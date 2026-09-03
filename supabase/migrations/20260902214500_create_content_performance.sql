CREATE TABLE IF NOT EXISTS public.content_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
    outstand_post_id TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement_rate NUMERIC(10,4) DEFAULT 0,
    metrics_by_account JSONB DEFAULT '[]'::jsonb,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(site_id, outstand_post_id)
);

CREATE INDEX IF NOT EXISTS content_performance_site_id_idx ON public.content_performance(site_id);
CREATE INDEX IF NOT EXISTS content_performance_content_id_idx ON public.content_performance(content_id);
CREATE INDEX IF NOT EXISTS content_performance_fetched_at_idx ON public.content_performance(fetched_at);
CREATE INDEX IF NOT EXISTS content_performance_site_fetched_at_idx ON public.content_performance(site_id, fetched_at DESC);

ALTER TABLE public.content_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view content_performance for their accessible sites" ON public.content_performance;
DROP POLICY IF EXISTS "Users can insert content_performance for their accessible sites" ON public.content_performance;
DROP POLICY IF EXISTS "Users can update content_performance for their accessible sites" ON public.content_performance;
DROP POLICY IF EXISTS "Users can delete content_performance for their accessible sites" ON public.content_performance;

CREATE POLICY "Users can view content_performance for their accessible sites"
ON public.content_performance FOR SELECT
USING (public.user_can(site_id, 'select'));

CREATE POLICY "Users can insert content_performance for their accessible sites"
ON public.content_performance FOR INSERT
WITH CHECK (public.user_can(site_id, 'insert'));

CREATE POLICY "Users can update content_performance for their accessible sites"
ON public.content_performance FOR UPDATE
USING (public.user_can(site_id, 'update'))
WITH CHECK (public.user_can(site_id, 'update'));

CREATE POLICY "Users can delete content_performance for their accessible sites"
ON public.content_performance FOR DELETE
USING (public.user_can(site_id, 'delete'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_performance TO authenticated;
GRANT ALL ON public.content_performance TO service_role;

CREATE OR REPLACE FUNCTION public.update_content_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_content_performance_modtime ON public.content_performance;
CREATE TRIGGER update_content_performance_modtime
BEFORE UPDATE ON public.content_performance
FOR EACH ROW
EXECUTE FUNCTION public.update_content_performance_updated_at();
