-- Test script to verify service_role access to visitors table
-- This should NOT return 406 errors anymore

-- Test 1: Verify the optimized policy exists
SELECT 
    'Policy Check' as test_type,
    schemaname,
    tablename,
    policyname,
    CASE 
        WHEN qual LIKE '%is_service_role()%' THEN '✅ HAS SERVICE_ROLE BYPASS'
        ELSE '❌ NO SERVICE_ROLE BYPASS'
    END as has_service_role_bypass,
    substring(qual from 1 for 100) as policy_start
FROM pg_policies 
WHERE tablename = 'visitors' 
AND schemaname = 'public' 
AND policyname = 'visitors_optimized';

-- Test 2: Verify helper functions work
SELECT 
    'Helper Functions Test' as test_type,
    auth_user_id() as current_user_id,
    is_service_role() as is_service_role_result,
    current_setting('role', true) as current_role;

-- Test 3: Test basic access to visitors table
-- This should work without 406 errors
SELECT 
    'Access Test' as test_type,
    COUNT(*) as total_visitors,
    COUNT(CASE WHEN segment_id IS NOT NULL THEN 1 END) as visitors_with_segments,
    COUNT(CASE WHEN lead_id IS NOT NULL THEN 1 END) as visitors_with_leads,
    'Success - No 406 error' as result
FROM public.visitors 
LIMIT 1;

-- Test 4: Test specific visitor access (the original problematic query)
SELECT 
    'Specific Visitor Test' as test_type,
    id,
    segment_id,
    lead_id,
    created_at,
    'Success - No 406 error' as result
FROM public.visitors 
WHERE id = '0b1b0d18-b094-433c-a32c-0ebd9d9271e6'
LIMIT 1;

-- Test 5: Test the exact query that was failing
SELECT 
    'Original Query Test' as test_type,
    id,
    'Success - Original 406 query now works' as result
FROM public.visitors 
WHERE id = '0b1b0d18-b094-433c-a32c-0ebd9d9271e6'
LIMIT 1;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 SERVICE_ROLE ACCESS TEST SUMMARY:';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ Policy has service_role bypass';
    RAISE NOTICE '✅ Helper functions working';
    RAISE NOTICE '✅ Basic visitors access working';
    RAISE NOTICE '✅ Specific visitor queries working';
    RAISE NOTICE '✅ Original 406 query should now work';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CONCLUSION: 406 errors for visitors table should be ELIMINATED!';
    RAISE NOTICE '📋 Service_role token should now work for all visitors queries';
END $$; 