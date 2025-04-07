-- Remove source column from requirements table since it's been replaced by campaign_requirements
ALTER TABLE public.requirements DROP COLUMN IF EXISTS source; 