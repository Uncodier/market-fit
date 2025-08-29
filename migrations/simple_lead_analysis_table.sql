-- Simple lead_analysis table creation
-- Execute this in Supabase SQL Editor if the full script fails

CREATE TABLE IF NOT EXISTS public.lead_analysis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Company Information
  company_name text NOT NULL,
  industry text,
  company_size text,
  annual_revenue text,
  
  -- Current KPIs (stored as JSONB)
  current_kpis jsonb DEFAULT '{}'::jsonb,
  
  -- Current Costs
  current_costs jsonb DEFAULT '{}'::jsonb,
  
  -- Sales Process Information
  sales_process jsonb DEFAULT '{}'::jsonb,
  
  -- Goals and Objectives
  goals jsonb DEFAULT '{}'::jsonb,
  
  -- Analysis Results (calculated and stored)
  analysis_results jsonb DEFAULT '{}'::jsonb,
  
  -- ROI Projections
  roi_projections jsonb DEFAULT '{}'::jsonb,
  
  -- Strategies and Opportunities
  strategies jsonb DEFAULT '{}'::jsonb,
  
  -- Contact Information (for follow-up)
  contact_info jsonb DEFAULT '{}'::jsonb,
  
  -- Analysis Status and Metadata
  status text DEFAULT 'draft',
  completion_percentage integer DEFAULT 0,
  
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
  
  -- Optional user association
  user_id uuid,
  site_id uuid,
  
  CONSTRAINT lead_analysis_pkey PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE public.lead_analysis ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Allow public insert for ROI calculator" ON public.lead_analysis
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access by ID" ON public.lead_analysis
  FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON public.lead_analysis TO authenticated;
GRANT SELECT, INSERT ON public.lead_analysis TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Simple lead_analysis table created successfully!';
END $$;
