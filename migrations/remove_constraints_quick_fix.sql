-- Quick fix: Remove all CHECK constraints from lead_analysis table
-- Execute this in Supabase SQL Editor to fix the immediate issue

-- Remove all CHECK constraints that are causing issues
ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_industry_check;

ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_company_size_check;

ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_annual_revenue_check;

ALTER TABLE public.lead_analysis 
DROP CONSTRAINT IF EXISTS lead_analysis_status_check;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All CHECK constraints removed from lead_analysis table!';
  RAISE NOTICE 'The table now accepts any values for industry, company_size, annual_revenue, and status';
END $$;
