-- MASTER PERFORMANCE OPTIMIZATION SCRIPT
-- Run this script to fix all 72 performance warnings

DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Complete Performance Optimization...';
    RAISE NOTICE '📊 Target: 66 Auth RLS + 9 Multiple Policies + 3 Duplicate Indexes = 72 total';
    RAISE NOTICE '';
END $$;

-- Auth RLS Performance Fixes
\i fix_auth_rls_performance.sql

-- Multiple Policies and Index Fixes  
\i fix_multiple_policies_and_indexes.sql

-- Final Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ALL PERFORMANCE OPTIMIZATIONS COMPLETE!';
    RAISE NOTICE 'Check your Supabase dashboard - warnings should be resolved.';
END $$; 