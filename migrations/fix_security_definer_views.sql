-- FIX SECURITY DEFINER VIEWS: Remove monitoring views that create security warnings
-- These views were created for debugging but Supabase flags them as security risks

DO $$
BEGIN
    RAISE NOTICE '🔧 FIXING SECURITY DEFINER VIEWS...';
    RAISE NOTICE '❌ Problem: Monitoring views flagged as security risks';
    RAISE NOTICE '✅ Solution: Remove non-essential monitoring views';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Remove security definer views that are flagged by Supabase
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️  Removing security definer views...';
    
    -- Drop policy performance monitor view
    DROP VIEW IF EXISTS public.policy_performance_monitor;
    RAISE NOTICE '   ✅ Dropped policy_performance_monitor view';
    
    -- Drop index usage monitor view
    DROP VIEW IF EXISTS public.index_usage_monitor;
    RAISE NOTICE '   ✅ Dropped index_usage_monitor view';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Security definer views removed successfully';
END $$;

-- ============================================================================
-- STEP 2: Verification - Check that views are gone
-- ============================================================================

DO $$
DECLARE
    view_count INTEGER := 0;
    view_name TEXT;
BEGIN
    RAISE NOTICE '🔍 VERIFICATION: Checking removed views...';
    RAISE NOTICE '';
    
    -- Check if policy_performance_monitor exists
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'policy_performance_monitor';
    
    IF view_count = 0 THEN
        RAISE NOTICE '✅ policy_performance_monitor: REMOVED';
    ELSE
        RAISE NOTICE '❌ policy_performance_monitor: STILL EXISTS';
    END IF;
    
    -- Check if index_usage_monitor exists
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'index_usage_monitor';
    
    IF view_count = 0 THEN
        RAISE NOTICE '✅ index_usage_monitor: REMOVED';
    ELSE
        RAISE NOTICE '❌ index_usage_monitor: STILL EXISTS';
    END IF;
    
    -- List any remaining views in public schema that might have SECURITY DEFINER
    RAISE NOTICE '';
    RAISE NOTICE '📋 Remaining views in public schema:';
    
    FOR view_name IN
        SELECT table_name
        FROM information_schema.views 
        WHERE table_schema = 'public'
        ORDER BY table_name
    LOOP
        RAISE NOTICE '   • %', view_name;
    END LOOP;
    
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views 
    WHERE table_schema = 'public';
    
    IF view_count = 0 THEN
        RAISE NOTICE '   → No views remaining in public schema';
    END IF;
    
END $$;

-- ============================================================================
-- STEP 3: Final status and recommendations
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SECURITY DEFINER VIEWS FIX COMPLETE!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Removed monitoring views that caused security warnings';
    RAISE NOTICE '✅ No essential functionality affected';
    RAISE NOTICE '✅ Database security improved';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Note: The removed views were for performance monitoring';
    RAISE NOTICE '   If needed later, they can be recreated without SECURITY DEFINER';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Expected result: Security warnings should disappear';
    
END $$;

SELECT 'SECURITY_DEFINER_VIEWS_FIXED' AS status; 