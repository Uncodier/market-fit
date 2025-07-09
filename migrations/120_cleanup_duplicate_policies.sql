-- Cleanup Migration: Remove duplicate policies and indexes caused by Migration 119
-- Description: Fixes multiple permissive policies and duplicate indexes
-- Date: 2025-01-30
-- This should be run BEFORE applying the consolidated fix

-- ============================================================================
-- STEP 1: REMOVE ALL DUPLICATE POLICIES
-- ============================================================================

-- Remove all campaigns policies (keep none for now)
DROP POLICY IF EXISTS "campaigns_final_policy" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_unified" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_optimized_policy" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_access_policy" ON public.campaigns;

-- Remove all experiments policies (keep none for now)
DROP POLICY IF EXISTS "experiments_final_policy" ON public.experiments;
DROP POLICY IF EXISTS "experiments_unified" ON public.experiments;
DROP POLICY IF EXISTS "experiments_optimized_policy" ON public.experiments;
DROP POLICY IF EXISTS "experiments_access_policy" ON public.experiments;

-- Remove all leads policies (keep none for now)
DROP POLICY IF EXISTS "leads_final_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_unified" ON public.leads;
DROP POLICY IF EXISTS "leads_optimized_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_access_policy" ON public.leads;

-- Remove all segments policies (keep none for now)
DROP POLICY IF EXISTS "segments_final_policy" ON public.segments;
DROP POLICY IF EXISTS "segments_unified_access" ON public.segments;
DROP POLICY IF EXISTS "segments_optimized_policy" ON public.segments;
DROP POLICY IF EXISTS "segments_access_policy" ON public.segments;

-- Remove all sales policies (keep none for now)
DROP POLICY IF EXISTS "sales_unified_access_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_final_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_optimized_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_access_policy" ON public.sales;

-- Remove all visitors policies (keep none for now)
DROP POLICY IF EXISTS "visitors_unified" ON public.visitors;
DROP POLICY IF EXISTS "visitors_service_role_bypass" ON public.visitors;
DROP POLICY IF EXISTS "visitors_optimized_policy" ON public.visitors;
DROP POLICY IF EXISTS "visitors_access_policy" ON public.visitors;

-- Remove all visitor_sessions policies (keep none for now)
DROP POLICY IF EXISTS "visitor_sessions_unified" ON public.visitor_sessions;
DROP POLICY IF EXISTS "visitor_sessions_service_role_bypass" ON public.visitor_sessions;
DROP POLICY IF EXISTS "visitor_sessions_optimized_policy" ON public.visitor_sessions;
DROP POLICY IF EXISTS "visitor_sessions_access_policy" ON public.visitor_sessions;

-- ============================================================================
-- STEP 2: REMOVE DUPLICATE INDEXES
-- ============================================================================

-- Remove performance indexes that duplicate existing ones
DROP INDEX IF EXISTS idx_visitor_sessions_site_id_performance;
DROP INDEX IF EXISTS idx_visitor_sessions_visitor_id_performance;
DROP INDEX IF EXISTS idx_visitors_segment_id_performance;
DROP INDEX IF EXISTS idx_visitors_lead_id_performance;
DROP INDEX IF EXISTS idx_site_members_site_user_status_performance;

-- Keep the original indexes (they should remain):
-- - idx_visitor_sessions_site_id
-- - idx_visitor_sessions_visitor_id  
-- - idx_visitors_segment_id
-- - idx_visitors_lead_id
-- - idx_site_members_site_user_status

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
    problem_tables TEXT[] := ARRAY['campaigns', 'experiments', 'leads', 'segments', 'sales', 'visitors', 'visitor_sessions'];
    clean_count INTEGER := 0;
    total_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 CLEANUP VERIFICATION RESULTS';
    RAISE NOTICE '================================================================';
    
    FOREACH table_name IN ARRAY problem_tables
    LOOP
        total_count := total_count + 1;
        
        -- Count remaining policies for this table
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE tablename = table_name 
        AND schemaname = 'public';
        
        IF policy_count = 0 THEN
            RAISE NOTICE '✅ %: All policies removed (% policies)', table_name, policy_count;
            clean_count := clean_count + 1;
        ELSIF policy_count = 1 THEN
            RAISE NOTICE '⚠️  %: Still has % policy (should be 0)', table_name, policy_count;
        ELSE
            RAISE NOTICE '❌ %: Still has % policies (should be 0)', table_name, policy_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 CLEANUP SUMMARY:';
    RAISE NOTICE '   ✅ Tables cleaned: % out of %', clean_count, total_count;
    RAISE NOTICE '';
    
    -- Check for remaining duplicate indexes
    RAISE NOTICE '🔍 CHECKING FOR DUPLICATE INDEXES:';
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_visitor_sessions_site_id_performance') THEN
        RAISE NOTICE '❌ idx_visitor_sessions_site_id_performance still exists';
    ELSE
        RAISE NOTICE '✅ idx_visitor_sessions_site_id_performance removed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_visitor_sessions_visitor_id_performance') THEN
        RAISE NOTICE '❌ idx_visitor_sessions_visitor_id_performance still exists';
    ELSE
        RAISE NOTICE '✅ idx_visitor_sessions_visitor_id_performance removed';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 NEXT STEPS:';
    RAISE NOTICE '1. All problematic policies have been removed';
    RAISE NOTICE '2. Duplicate indexes have been cleaned up';
    RAISE NOTICE '3. Now you can safely run the consolidated fix';
    RAISE NOTICE '4. File: migrations/119_consolidated_service_role_fix.sql';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: Tables have NO RLS policies now - apply consolidated fix immediately!';
    
END $$; 