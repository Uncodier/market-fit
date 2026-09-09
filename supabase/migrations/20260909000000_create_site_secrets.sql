-- Enable vault extension
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Create table site_secrets
CREATE TABLE IF NOT EXISTS public.site_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    use_case TEXT NOT NULL,
    vault_secret_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(site_id, provider, use_case)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_site_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_secrets_updated_at_trigger
BEFORE UPDATE ON public.site_secrets
FOR EACH ROW
EXECUTE FUNCTION update_site_secrets_updated_at();

-- RLS
ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view secrets of accessible sites"
ON public.site_secrets FOR SELECT
TO authenticated
USING (
    site_id IN (
        SELECT id FROM get_my_accessible_sites()
    )
);

CREATE POLICY "Users can insert secrets to accessible sites"
ON public.site_secrets FOR INSERT
TO authenticated
WITH CHECK (
    site_id IN (
        SELECT id FROM get_my_accessible_sites()
    )
);

CREATE POLICY "Users can update secrets of accessible sites"
ON public.site_secrets FOR UPDATE
TO authenticated
USING (
    site_id IN (
        SELECT id FROM get_my_accessible_sites()
    )
);

CREATE POLICY "Users can delete secrets of accessible sites"
ON public.site_secrets FOR DELETE
TO authenticated
USING (
    site_id IN (
        SELECT id FROM get_my_accessible_sites()
    )
);
