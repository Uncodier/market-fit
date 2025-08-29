-- Fix lead_analysis table constraints to allow NULL values
-- Execute this in Supabase SQL Editor

-- Drop existing constraints
ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_industry_check;

ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_company_size_check;

ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_annual_revenue_check;

-- Add new constraints that allow NULL values
ALTER TABLE public.lead_analysis 
ADD CONSTRAINT lead_analysis_industry_check 
CHECK (industry IS NULL OR industry = ANY (ARRAY[
  'technology'::text, 
  'finance'::text, 
  'healthcare'::text, 
  'education'::text, 
  'retail'::text, 
  'manufacturing'::text, 
  'services'::text, 
  'hospitality'::text, 
  'media'::text, 
  'real_estate'::text, 
  'logistics'::text, 
  'nonprofit'::text, 
  'other'::text
]));

ALTER TABLE public.lead_analysis 
ADD CONSTRAINT lead_analysis_company_size_check 
CHECK (company_size IS NULL OR company_size = ANY (ARRAY[
  '1-10'::text, 
  '11-50'::text, 
  '51-200'::text, 
  '201-500'::text, 
  '501-1000'::text, 
  '1000+'::text
]));

ALTER TABLE public.lead_analysis 
ADD CONSTRAINT lead_analysis_annual_revenue_check 
CHECK (annual_revenue IS NULL OR annual_revenue = ANY (ARRAY[
  '<1M'::text, 
  '1M-5M'::text, 
  '5M-10M'::text, 
  '10M-50M'::text, 
  '50M-100M'::text, 
  '100M+'::text
]));

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Lead analysis constraints updated to allow NULL values!';
END $$;
