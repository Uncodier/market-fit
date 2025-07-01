-- Migration: Fix RLS policies for visitor_sessions and visitors tables
-- Description: Add missing RLS policies for visitor_sessions and visitors tables
-- Date: 2025-01-30
-- Fixes security warnings: rls_enabled_no_policy for public.visitor_sessions and public.visitors

-- ============================================================================
-- VISITOR SESSIONS TABLE
-- ============================================================================
-- visitor_sessions has a direct site_id, so we can use the standard pattern

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "visitor_sessions_unified" ON public.visitor_sessions;

-- Create unified policy for visitor_sessions
CREATE POLICY "visitor_sessions_unified" ON public.visitor_sessions
FOR ALL 
USING (
  -- Allow access if user is a member of the site
  EXISTS (
    SELECT 1 
    FROM public.site_members sm 
    WHERE sm.site_id = visitor_sessions.site_id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
);

-- ============================================================================
-- VISITORS TABLE
-- ============================================================================
-- visitors does NOT have a direct site_id, but can be accessed through:
-- 1. segment_id -> segments.site_id
-- 2. lead_id -> leads.site_id

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;

-- Create unified policy for visitors
CREATE POLICY "visitors_unified" ON public.visitors
FOR ALL 
USING (
  -- Allow access if user is a member of the site through segment_id
  (
    visitors.segment_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM public.segments s 
      JOIN public.site_members sm ON sm.site_id = s.site_id 
      WHERE s.id = visitors.segment_id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
  OR
  -- Allow access if user is a member of the site through lead_id
  (
    visitors.lead_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 
      FROM public.leads l 
      JOIN public.site_members sm ON sm.site_id = l.site_id 
      WHERE l.id = visitors.lead_id 
      AND sm.user_id = (SELECT auth.uid())
      AND sm.status = 'active'
    )
  )
  OR
  -- Allow access if visitor has sessions on sites the user has access to
  EXISTS (
    SELECT 1 
    FROM public.visitor_sessions vs 
    JOIN public.site_members sm ON sm.site_id = vs.site_id 
    WHERE vs.visitor_id = visitors.id 
    AND sm.user_id = (SELECT auth.uid())
    AND sm.status = 'active'
  )
);

-- ============================================================================
-- INDEXING OPTIMIZATION
-- ============================================================================
-- Add comment for documentation
COMMENT ON POLICY "visitor_sessions_unified" ON public.visitor_sessions IS 
'Allows users to access visitor sessions for sites they are members of';

COMMENT ON POLICY "visitors_unified" ON public.visitors IS 
'Allows users to access visitors through segment membership, lead ownership, or session access to their sites';

-- Ensure necessary indexes exist for performance
-- These should already exist from previous migrations, but we verify them

-- Index for visitor_sessions.site_id (should exist as idx_visitor_sessions_site_id)
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_site_id ON public.visitor_sessions(site_id);

-- Index for visitors.segment_id (should exist as idx_visitors_segment_id)  
CREATE INDEX IF NOT EXISTS idx_visitors_segment_id ON public.visitors(segment_id);

-- Index for visitors.lead_id (should exist as idx_visitors_lead_id)
CREATE INDEX IF NOT EXISTS idx_visitors_lead_id ON public.visitors(lead_id);

-- Index for visitor_sessions.visitor_id (should exist as idx_visitor_sessions_visitor_id)
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON public.visitor_sessions(visitor_id);

-- Index for site_members for performance
CREATE INDEX IF NOT EXISTS idx_site_members_site_user_status ON public.site_members(site_id, user_id, status); 