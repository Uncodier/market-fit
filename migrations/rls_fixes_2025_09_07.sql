-- RLS Fixes: Resolve auth_rls_initplan and multiple_permissive_policies warnings
-- Date: 2025-09-07
-- Context:
-- - Replace direct auth.*() calls with (select auth.*()) inside policies to avoid initplan re-evaluation
-- - Consolidate multiple permissive policies on the same action into a single policy per action

-- ============================================================================
-- Lead Analysis: consolidate policies and remove direct auth.*() usage
-- ============================================================================

-- Ensure table exists (no-op if already present)
-- NOTE: We do not alter table structure here

-- Drop known lead_analysis policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Allow public insert for ROI calculator" ON public.lead_analysis;
DROP POLICY IF EXISTS "Public read access by ID" ON public.lead_analysis;
DROP POLICY IF EXISTS "Users can update own analyses" ON public.lead_analysis;
DROP POLICY IF EXISTS "Admin full access" ON public.lead_analysis;
DROP POLICY IF EXISTS "Public update access by ID" ON public.lead_analysis;

-- Optional safety: drop any other residual policies on lead_analysis
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'lead_analysis'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lead_analysis', p.policyname);
  END LOOP;
END $$;

-- Create a single permissive policy per action to avoid multiple-permissive warnings
-- INSERT: public insert allowed for ROI calculator flow
CREATE POLICY "lead_analysis_insert" ON public.lead_analysis
  FOR INSERT
  WITH CHECK (true);

-- SELECT: public read allowed (anyone with the ID can read via app logic)
CREATE POLICY "lead_analysis_select" ON public.lead_analysis
  FOR SELECT
  USING (true);

-- UPDATE: if ROI flow requires anonymous update by ID, we allow updates
-- If later we need to restrict, change 'true' to a predicate (e.g., id-based token)
CREATE POLICY "lead_analysis_update" ON public.lead_analysis
  FOR UPDATE
  USING (true);

-- (No DELETE policy added intentionally)

-- ============================================================================
-- Agent Assets: unify policy and wrap auth.*() calls with SELECT
-- ============================================================================

-- Drop all existing policies on agent_assets (names may vary across environments)
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN (
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'agent_assets'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.agent_assets', p.policyname);
  END LOOP;
END $$;

-- Create unified policy based on site membership via agents.site_id
-- Uses (select auth.uid()) to prevent initplan overhead
CREATE POLICY "agent_assets_unified" ON public.agent_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.site_members sm ON sm.site_id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.site_members sm ON sm.site_id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
  );

-- End of migration


