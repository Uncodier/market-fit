-- Alternative: More restrictive RLS policies for lead_analysis table
-- Use this if you want to make the table more secure

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public insert for ROI calculator" ON public.lead_analysis;
DROP POLICY IF EXISTS "Users can view own analyses" ON public.lead_analysis;
DROP POLICY IF EXISTS "Users can update own analyses" ON public.lead_analysis;
DROP POLICY IF EXISTS "Admin full access" ON public.lead_analysis;

-- OPTION 1: Only allow inserts, no public reads
CREATE POLICY "Allow public insert only" ON public.lead_analysis
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can view all" ON public.lead_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admin can update all" ON public.lead_analysis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- OPTION 2: Completely private - only admins can access
-- CREATE POLICY "Admin only access" ON public.lead_analysis
--   FOR ALL USING (
--     EXISTS (
--       SELECT 1 FROM auth.users 
--       WHERE auth.users.id = auth.uid()
--       AND auth.users.raw_user_meta_data->>'role' = 'admin'
--     )
--   );

-- Remove public grants if you want to be more restrictive
-- REVOKE SELECT ON public.lead_analysis_summary FROM anon;
-- REVOKE INSERT ON public.lead_analysis FROM anon;
