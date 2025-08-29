-- Fix RLS policies to allow anonymous updates for lead_analysis table
-- This is needed because the ROI calculator should work for anonymous users

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can update own analyses" ON public.lead_analysis;
DROP POLICY IF EXISTS "Admin full access" ON public.lead_analysis;

-- Create new policy that allows anonymous updates by ID
-- Anyone who knows the ID can update the analysis (same as read access)
CREATE POLICY "Public update access by ID" ON public.lead_analysis
  FOR UPDATE USING (true);

-- Recreate admin policy without referencing auth.users table
-- (We'll handle admin access through application logic if needed)
CREATE POLICY "Admin full access" ON public.lead_analysis
  FOR ALL USING (
    -- Only allow if user has admin role in their JWT claims
    (auth.jwt() ->> 'role' = 'admin')
  );
