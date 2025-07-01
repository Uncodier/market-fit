-- Diagnostic script to test experiment_segments RLS policy conditions
-- This will help us understand why the policy is still blocking inserts

-- Test with the specific user and site from the error logs
WITH test_data AS (
    SELECT 
        '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid as user_id,
        'cfe4d280-df8a-4b2c-96db-f02ba04368c1'::uuid as site_id
)

-- 1. Check if user has active membership in the site
SELECT 
    '1. User Site Membership:' as check_type,
    sm.user_id,
    sm.site_id,
    sm.status,
    sm.role,
    CASE 
        WHEN sm.status = 'active' THEN '✅ ACTIVE'
        ELSE '❌ NOT ACTIVE'
    END as membership_status
FROM test_data td
LEFT JOIN site_members sm ON sm.user_id = td.user_id AND sm.site_id = td.site_id;

-- 2. Check experiments in this site
WITH test_data AS (
    SELECT 
        '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid as user_id,
        'cfe4d280-df8a-4b2c-96db-f02ba04368c1'::uuid as site_id
)
SELECT 
    '2. Available Experiments:' as check_type,
    e.id as experiment_id,
    e.name as experiment_name,
    e.site_id,
    CASE 
        WHEN e.site_id = td.site_id THEN '✅ CORRECT SITE'
        ELSE '❌ WRONG SITE'
    END as site_match
FROM test_data td
LEFT JOIN experiments e ON e.site_id = td.site_id
ORDER BY e.created_at DESC
LIMIT 5;

-- 3. Test the exact RLS policy logic for a specific experiment
WITH test_data AS (
    SELECT 
        '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid as user_id,
        'cfe4d280-df8a-4b2c-96db-f02ba04368c1'::uuid as site_id
)
SELECT 
    '3. RLS Policy Test:' as check_type,
    e.id as experiment_id,
    e.name as experiment_name,
    -- Test the exact EXISTS condition from our policy
    EXISTS (
        SELECT 1 
        FROM experiments e2
        JOIN site_members sm ON sm.site_id = e2.site_id
        WHERE e2.id = e.id 
            AND sm.user_id = td.user_id
            AND sm.status = 'active'
    ) as policy_would_allow,
    -- Break down the components
    (SELECT COUNT(*) FROM site_members sm WHERE sm.site_id = e.site_id AND sm.user_id = td.user_id) as user_membership_count,
    (SELECT COUNT(*) FROM site_members sm WHERE sm.site_id = e.site_id AND sm.user_id = td.user_id AND sm.status = 'active') as active_membership_count
FROM test_data td
LEFT JOIN experiments e ON e.site_id = td.site_id
ORDER BY e.created_at DESC
LIMIT 3;

-- 4. Test if we can simulate the current_setting auth context
SELECT 
    '4. Auth Context:' as check_type,
    current_setting('request.jwt.claims', true) as jwt_claims,
    current_setting('request.jwt.claim.sub', true) as jwt_user_id;

-- 5. Show current RLS policy for reference
SELECT 
    '5. Current Policy:' as check_type,
    policyname,
    cmd,
    qual as policy_condition
FROM pg_policies 
WHERE tablename = 'experiment_segments'; 