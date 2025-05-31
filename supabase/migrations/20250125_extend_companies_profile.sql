-- Extend companies table with additional profile fields
-- Corrected array syntax for PostgreSQL

ALTER TABLE public.companies 
ADD COLUMN logo_url TEXT,
ADD COLUMN cover_image_url TEXT,
ADD COLUMN social_media JSONB DEFAULT '{}', -- Twitter, Facebook, Instagram, etc.
ADD COLUMN key_people JSONB DEFAULT '[]', -- CEO, CTO, etc.
ADD COLUMN funding_info JSONB DEFAULT '{}', -- Total funding, investors, rounds
ADD COLUMN certifications TEXT[] DEFAULT ARRAY[]::TEXT[], -- ISO, etc.
ADD COLUMN awards TEXT[] DEFAULT ARRAY[]::TEXT[], -- Industry awards
ADD COLUMN business_model TEXT CHECK (business_model IN ('b2b', 'b2c', 'b2b2c', 'marketplace', 'saas', 'ecommerce', 'other')),
ADD COLUMN products_services JSONB DEFAULT '[]',
ADD COLUMN tech_stack TEXT[] DEFAULT ARRAY[]::TEXT[], -- Technologies used
ADD COLUMN languages TEXT[] DEFAULT ARRAY['en']::TEXT[], -- Supported languages
ADD COLUMN business_hours JSONB DEFAULT '{}', -- Operating hours
ADD COLUMN video_url TEXT, -- Company intro video
ADD COLUMN press_releases JSONB DEFAULT '[]',
ADD COLUMN partnerships JSONB DEFAULT '[]',
ADD COLUMN competitor_info JSONB DEFAULT '{}',
ADD COLUMN sustainability_score INTEGER CHECK (sustainability_score >= 0 AND sustainability_score <= 100),
ADD COLUMN diversity_info JSONB DEFAULT '{}',
ADD COLUMN remote_policy TEXT CHECK (remote_policy IN ('remote_first', 'hybrid', 'office_only', 'flexible')),
ADD COLUMN office_locations JSONB DEFAULT '[]',
ADD COLUMN market_cap BIGINT, -- For public companies
ADD COLUMN last_funding_date DATE,
ADD COLUMN ipo_date DATE,
ADD COLUMN acquisition_date DATE,
ADD COLUMN acquired_by_id UUID REFERENCES public.companies(id);

-- Índices para campos nuevos
CREATE INDEX IF NOT EXISTS idx_companies_business_model ON public.companies(business_model);
CREATE INDEX IF NOT EXISTS idx_companies_remote_policy ON public.companies(remote_policy);
CREATE INDEX IF NOT EXISTS idx_companies_acquired_by_id ON public.companies(acquired_by_id);
CREATE INDEX IF NOT EXISTS idx_companies_last_funding_date ON public.companies(last_funding_date);
CREATE INDEX IF NOT EXISTS idx_companies_ipo_date ON public.companies(ipo_date);

-- Comentarios para documentar los nuevos campos
COMMENT ON COLUMN public.companies.logo_url IS 'Company logo image URL';
COMMENT ON COLUMN public.companies.cover_image_url IS 'Company cover/banner image URL';
COMMENT ON COLUMN public.companies.social_media IS 'Social media profiles (Twitter, Facebook, LinkedIn, etc.)';
COMMENT ON COLUMN public.companies.key_people IS 'Key company personnel (CEO, CTO, founders, etc.)';
COMMENT ON COLUMN public.companies.funding_info IS 'Funding information (total raised, investors, rounds)';
COMMENT ON COLUMN public.companies.certifications IS 'Company certifications (ISO, SOC2, etc.)';
COMMENT ON COLUMN public.companies.awards IS 'Company awards and recognitions';
COMMENT ON COLUMN public.companies.business_model IS 'Business model type';
COMMENT ON COLUMN public.companies.products_services IS 'List of products and services offered';
COMMENT ON COLUMN public.companies.tech_stack IS 'Technologies and tools used by the company';
COMMENT ON COLUMN public.companies.languages IS 'Languages supported by the company';
COMMENT ON COLUMN public.companies.business_hours IS 'Operating hours and timezone information';
COMMENT ON COLUMN public.companies.video_url IS 'Company introduction or promotional video URL';
COMMENT ON COLUMN public.companies.press_releases IS 'Company press releases and news';
COMMENT ON COLUMN public.companies.partnerships IS 'Strategic partnerships and alliances';
COMMENT ON COLUMN public.companies.competitor_info IS 'Information about main competitors';
COMMENT ON COLUMN public.companies.sustainability_score IS 'Environmental and sustainability score (0-100)';
COMMENT ON COLUMN public.companies.diversity_info IS 'Diversity and inclusion information';
COMMENT ON COLUMN public.companies.remote_policy IS 'Remote work policy';
COMMENT ON COLUMN public.companies.office_locations IS 'Physical office locations';
COMMENT ON COLUMN public.companies.market_cap IS 'Market capitalization for public companies';
COMMENT ON COLUMN public.companies.last_funding_date IS 'Date of last funding round';
COMMENT ON COLUMN public.companies.ipo_date IS 'Initial public offering date';
COMMENT ON COLUMN public.companies.acquisition_date IS 'Date when company was acquired';
COMMENT ON COLUMN public.companies.acquired_by_id IS 'ID of the company that acquired this one'; 