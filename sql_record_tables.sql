CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.record_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    parent_category_id UUID REFERENCES public.record_categories(id) ON DELETE SET NULL,
    template_fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by site
CREATE INDEX IF NOT EXISTS idx_record_categories_site_id ON public.record_categories(site_id);

CREATE TABLE IF NOT EXISTS public.records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.record_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    relations JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'draft',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by site and category
CREATE INDEX IF NOT EXISTS idx_records_site_id ON public.records(site_id);
CREATE INDEX IF NOT EXISTS idx_records_category_id ON public.records(category_id);

-- Optional: index on relations if we want to query by relations (GIN index on jsonb)
CREATE INDEX IF NOT EXISTS idx_records_relations ON public.records USING GIN (relations);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_record_categories_modtime ON public.record_categories;
CREATE TRIGGER update_record_categories_modtime
    BEFORE UPDATE ON public.record_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_records_modtime ON public.records;
CREATE TRIGGER update_records_modtime
    BEFORE UPDATE ON public.records
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- RLS Policies
ALTER TABLE public.record_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- Note: Policies need to be configured for admin/service_role/users. 
-- For this setup, we usually allow authenticated users full access to their site_id.
