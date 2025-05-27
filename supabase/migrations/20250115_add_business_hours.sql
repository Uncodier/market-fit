-- Add business_hours column to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.settings.business_hours IS 'Business hours configuration for different regions/locations. Array of objects containing name, timezone and days schedule';

-- Update RLS policies if needed (settings table should already have proper policies) 