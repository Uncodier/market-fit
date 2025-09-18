-- Fix agent_assets RLS to allow site owners (not only active members)
-- Date: 2025-09-18

-- Drop existing unified policy if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'agent_assets' AND policyname = 'agent_assets_unified'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "agent_assets_unified" ON public.agent_assets';
  END IF;
END $$;

-- Recreate policy: allow active site members OR site owners
-- Uses (select auth.uid()) to avoid initplan overhead
CREATE POLICY "agent_assets_unified" ON public.agent_assets
  FOR ALL
  USING (
    -- Active member of the site that owns the agent
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.site_members sm ON sm.site_id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
    OR
    -- Site owner via site_ownership mapping
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.site_ownership so ON so.site_id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND so.user_id = (select auth.uid())
    )
    OR
    -- Site owner stored directly on sites.user_id (backward compatibility)
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.sites s ON s.id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND s.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    -- Same predicate for writes
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.site_members sm ON sm.site_id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND sm.user_id = (select auth.uid())
        AND sm.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.site_ownership so ON so.site_id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND so.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.sites s ON s.id = a.site_id
      WHERE a.id = agent_assets.agent_id
        AND s.user_id = (select auth.uid())
    )
  );


