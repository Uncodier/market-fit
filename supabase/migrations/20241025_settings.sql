-- Create settings table to store all additional site settings
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE UNIQUE,
  
  -- Company information
  about TEXT,
  company_size TEXT,
  industry TEXT,
  products JSONB DEFAULT '[]',
  services JSONB DEFAULT '[]',
  swot JSONB DEFAULT '{"strengths": "", "weaknesses": "", "opportunities": "", "threats": ""}',
  locations JSONB DEFAULT '[]',
  
  -- Marketing information
  marketing_budget JSONB DEFAULT '{"total": 0, "available": 0}',
  marketing_channels JSONB DEFAULT '[]',
  social_media JSONB DEFAULT '[]',
  target_keywords JSONB DEFAULT '[]',
  content_calendar JSONB DEFAULT '[]',
  
  -- Tracking information
  tracking JSONB DEFAULT '{"track_visitors": false, "track_actions": false, "record_screen": false}',
  tracking_code TEXT,
  analytics_provider TEXT,
  analytics_id TEXT,
  
  -- Team information
  team_members JSONB DEFAULT '[]',
  team_roles JSONB DEFAULT '[]',
  org_structure JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster site_id lookup
CREATE INDEX IF NOT EXISTS settings_site_id_idx ON public.settings(site_id);

-- Add competitors field to sites table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'competitors'
  ) THEN
    ALTER TABLE public.sites ADD COLUMN competitors JSONB DEFAULT '[]';
  END IF;
END
$$;

-- Add focus_mode field to sites table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'focus_mode'
  ) THEN
    ALTER TABLE public.sites ADD COLUMN focus_mode INTEGER DEFAULT 50;
  END IF;
END
$$;

-- Function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for settings table
DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION update_timestamp(); 