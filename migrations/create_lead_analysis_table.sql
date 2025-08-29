-- Migration: Create lead_analysis table for ROI Calculator
-- Description: Creates the lead_analysis table to store comprehensive business analysis data from the ROI calculator
-- Date: 2024-12-19

-- Drop table if exists (for clean recreation - use with caution in production)
-- DROP TABLE IF EXISTS public.lead_analysis CASCADE;

-- Create lead_analysis table
CREATE TABLE IF NOT EXISTS public.lead_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Company Information
  company_name text NOT NULL,
  industry text CHECK (industry = ANY (ARRAY[
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
  ])),
  company_size text CHECK (company_size = ANY (ARRAY[
    '1-10'::text, 
    '11-50'::text, 
    '51-200'::text, 
    '201-500'::text, 
    '501-1000'::text, 
    '1000+'::text
  ])),
  annual_revenue text CHECK (annual_revenue = ANY (ARRAY[
    '<1M'::text, 
    '1M-5M'::text, 
    '5M-10M'::text, 
    '10M-50M'::text, 
    '50M-100M'::text, 
    '100M+'::text
  ])),
  
  -- Current KPIs (stored as JSONB for flexibility)
  current_kpis jsonb DEFAULT '{
    "monthlyRevenue": 0,
    "customerAcquisitionCost": 0,
    "customerLifetimeValue": 0,
    "conversionRate": 0,
    "averageOrderValue": 0,
    "monthlyLeads": 0,
    "salesCycleLength": 0,
    "convertedCustomers": 0,
    "customerLifetimeSpan": 0,
    "churnRate": 0,
    "marketingQualifiedLeads": 0,
    "salesQualifiedLeads": 0
  }'::jsonb,
  
  -- Current Costs
  current_costs jsonb DEFAULT '{
    "marketingBudget": 0,
    "salesTeamCost": 0,
    "salesCommission": 0,
    "technologyCosts": 0,
    "operationalCosts": 0,
    "cogs": 0,
    "otherCosts": 0,
    "totalMonthlyCosts": 0
  }'::jsonb,
  
  -- Sales Process Information
  sales_process jsonb DEFAULT '{
    "leadSources": [],
    "qualificationProcess": {
      "deepResearch": false,
      "manualResearch": false,
      "interviews": false,
      "icpTargeting": false,
      "behaviorAnalysis": false,
      "leadScoring": false,
      "demographicFiltering": false,
      "companySize": false,
      "budgetQualification": false,
      "decisionMakerID": false,
      "painPointAssessment": false,
      "competitorAnalysis": false
    },
    "followUpFrequency": "",
    "closingTechniques": [],
    "painPoints": [],
    "salesTeamSize": 0,
    "averageDealSize": 0,
    "winRate": 0,
    "salesActivities": {
      "coldCalls": false,
      "personalizedFollowUp": false,
      "videoCalls": false,
      "transactionalEmails": false,
      "socialSelling": false,
      "contentMarketing": false,
      "referralProgram": false,
      "webinarsEvents": false,
      "paidAds": false,
      "seoContent": false,
      "partnerships": false,
      "directMail": false,
      "tradeShows": false,
      "influencerMarketing": false,
      "retargeting": false,
      "activations": false,
      "physicalVisits": false,
      "personalBrand": false
    }
  }'::jsonb,
  
  -- Goals and Objectives
  goals jsonb DEFAULT '{
    "revenueTarget": 0,
    "timeframe": "",
    "primaryObjectives": [],
    "growthChallenges": [],
    "marketingGoals": [],
    "salesGoals": []
  }'::jsonb,
  
  -- Analysis Results (calculated and stored)
  analysis_results jsonb DEFAULT '{
    "currentROI": 0,
    "projectedROI": 0,
    "potentialIncrease": 0,
    "projectedRevenue": 0,
    "projectedCosts": 0,
    "opportunityCosts": 0,
    "recommendations": [],
    "riskFactors": [],
    "implementationPlan": {},
    "expectedTimeline": ""
  }'::jsonb,
  
  -- ROI Projections
  roi_projections jsonb DEFAULT '{
    "threeMonth": {"revenue": 0, "costs": 0, "roi": 0},
    "sixMonth": {"revenue": 0, "costs": 0, "roi": 0},
    "twelveMonth": {"revenue": 0, "costs": 0, "roi": 0},
    "twentyFourMonth": {"revenue": 0, "costs": 0, "roi": 0}
  }'::jsonb,
  
  -- Strategies and Opportunities
  strategies jsonb DEFAULT '{
    "leadOptimization": [],
    "conversionImprovement": [],
    "costReduction": [],
    "revenueGrowth": [],
    "processAutomation": [],
    "technologyUpgrades": []
  }'::jsonb,
  
  -- Contact Information (for follow-up)
  contact_info jsonb DEFAULT '{
    "email": "",
    "phone": "",
    "name": "",
    "title": "",
    "preferredContactMethod": "",
    "bestTimeToCall": ""
  }'::jsonb,
  
  -- Analysis Status and Metadata
  status text DEFAULT 'draft' CHECK (status = ANY (ARRAY[
    'draft'::text, 
    'completed'::text, 
    'reviewed'::text, 
    'contacted'::text, 
    'converted'::text
  ])),
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  
  -- Tracking and Attribution
  source text DEFAULT 'roi-calculator',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  ip_address inet,
  user_agent text,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  
  -- Optional user association (if they sign up)
  user_id uuid,
  site_id uuid,
  

  
  CONSTRAINT lead_analysis_pkey PRIMARY KEY (id),
  CONSTRAINT lead_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT lead_analysis_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL
);

-- Add comments for documentation
COMMENT ON TABLE public.lead_analysis IS 'ROI Calculator lead analysis data - stores comprehensive business analysis for prospects';
COMMENT ON COLUMN public.lead_analysis.current_kpis IS 'Current business KPIs and metrics including revenue, CAC, LTV, conversion rates, etc.';
COMMENT ON COLUMN public.lead_analysis.current_costs IS 'Current business costs breakdown including marketing, sales, technology, and operational expenses';
COMMENT ON COLUMN public.lead_analysis.sales_process IS 'Information about current sales process, lead sources, qualification methods, and challenges';
COMMENT ON COLUMN public.lead_analysis.goals IS 'Business goals, targets, objectives, and growth challenges';
COMMENT ON COLUMN public.lead_analysis.analysis_results IS 'Calculated ROI analysis results, recommendations, and projections';
COMMENT ON COLUMN public.lead_analysis.roi_projections IS 'ROI projections for different timeframes (3, 6, 12, 24 months)';
COMMENT ON COLUMN public.lead_analysis.strategies IS 'Recommended strategies and opportunities for growth and optimization';
COMMENT ON COLUMN public.lead_analysis.contact_info IS 'Contact information for follow-up and sales outreach';

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_lead_analysis_created_at ON public.lead_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_status ON public.lead_analysis(status);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_company_size ON public.lead_analysis(company_size);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_industry ON public.lead_analysis(industry);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_source ON public.lead_analysis(source);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_completion ON public.lead_analysis(completion_percentage);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_user_id ON public.lead_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_analysis_site_id ON public.lead_analysis(site_id);


-- Enable Row Level Security
ALTER TABLE public.lead_analysis ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public insert for ROI calculator" ON public.lead_analysis;
DROP POLICY IF EXISTS "Public read access by ID" ON public.lead_analysis;
DROP POLICY IF EXISTS "Users can update own analyses" ON public.lead_analysis;
DROP POLICY IF EXISTS "Admin full access" ON public.lead_analysis;

-- Create RLS policies

-- Policy for public access (ROI calculator is public)
CREATE POLICY "Allow public insert for ROI calculator" ON public.lead_analysis
  FOR INSERT WITH CHECK (true);

-- Policy for public read access by ID (anyone with ID can view)
CREATE POLICY "Public read access by ID" ON public.lead_analysis
  FOR SELECT USING (true);

-- Policy for users to update their own analyses
CREATE POLICY "Users can update own analyses" ON public.lead_analysis
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy for admin access (users with admin role can access all records)
CREATE POLICY "Admin full access" ON public.lead_analysis
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_lead_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_update_lead_analysis_updated_at ON public.lead_analysis;
CREATE TRIGGER trigger_update_lead_analysis_updated_at
  BEFORE UPDATE ON public.lead_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_analysis_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.lead_analysis TO authenticated;
GRANT SELECT, INSERT ON public.lead_analysis TO anon;

-- Optional: Create a view for easier querying of lead analysis data
CREATE OR REPLACE VIEW public.lead_analysis_summary AS
SELECT 
  id,
  company_name,
  industry,
  company_size,
  annual_revenue,
  status,
  completion_percentage,
  (current_kpis->>'monthlyRevenue')::numeric as monthly_revenue,
  (current_kpis->>'customerAcquisitionCost')::numeric as cac,
  (current_kpis->>'customerLifetimeValue')::numeric as ltv,
  (current_kpis->>'conversionRate')::numeric as conversion_rate,
  (analysis_results->>'currentROI')::numeric as current_roi,
  (analysis_results->>'projectedROI')::numeric as projected_roi,
  (analysis_results->>'potentialIncrease')::numeric as potential_increase,
  contact_info->>'email' as contact_email,
  contact_info->>'name' as contact_name,
  source,
  utm_source,
  utm_campaign,
  created_at,
  updated_at,
  completed_at
FROM public.lead_analysis;

-- Grant access to the view
GRANT SELECT ON public.lead_analysis_summary TO authenticated;
GRANT SELECT ON public.lead_analysis_summary TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Lead analysis table and related objects created successfully!';
  RAISE NOTICE 'Table: public.lead_analysis';
  RAISE NOTICE 'View: public.lead_analysis_summary';
  RAISE NOTICE 'Indexes: 8 performance indexes created';
  RAISE NOTICE 'RLS: Row Level Security enabled with 4 policies';
  RAISE NOTICE 'Triggers: Auto-update timestamp trigger created';
END $$;
