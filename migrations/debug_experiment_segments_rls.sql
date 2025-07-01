-- Debug script for experiment_segments RLS issues
-- This script will help us understand why the RLS policy is still failing

-- ============================================================================
-- 1. CHECK CURRENT RLS POLICIES
-- ============================================================================

SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'experiment_segments'
ORDER BY policyname;

-- ============================================================================
-- 2. CHECK USER ACCESS TO SITE
-- ============================================================================

-- Check if the user has access to the specific site
SELECT 
    sm.user_id,
    sm.site_id,
    sm.status,
    sm.role,
    s.name as site_name
FROM site_members sm
JOIN sites s ON s.id = sm.site_id
WHERE sm.user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'
    AND sm.site_id = 'cfe4d280-df8a-4b2c-96db-f02ba04368c1';

-- ============================================================================
-- 3. CHECK EXPERIMENTS THE USER HAS ACCESS TO
-- ============================================================================

SELECT 
    e.id,
    e.name,
    e.site_id,
    sm.user_id,
    sm.status as member_status
FROM experiments e
JOIN site_members sm ON sm.site_id = e.site_id
WHERE sm.user_id = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'
    AND sm.status = 'active'
    AND e.site_id = 'cfe4d280-df8a-4b2c-96db-f02ba04368c1';

-- ============================================================================
-- 4. CHECK IF auth.uid() FUNCTION WORKS
-- ============================================================================

-- This simulates what happens when the user makes a request
-- Note: This will only work if you run it as the authenticated user
SELECT 
    auth.uid() as current_user_id,
    '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid as expected_user_id,
    auth.uid() = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid as user_match;

-- ============================================================================
-- 5. TEST THE RLS POLICY LOGIC MANUALLY
-- ============================================================================

-- Test if the policy logic would work for a specific experiment_id and user
-- Replace 'your-experiment-id-here' with an actual experiment ID
WITH test_data AS (
    SELECT 
        'cfe4d280-df8a-4b2c-96db-f02ba04368c1'::uuid as site_id,
        '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'::uuid as user_id
)
SELECT 
    e.id as experiment_id,
    e.name as experiment_name,
    EXISTS (
        SELECT 1 FROM experiments e2
        JOIN site_members sm ON sm.site_id = e2.site_id
        WHERE e2.id = e.id 
        AND sm.user_id = (SELECT user_id FROM test_data)
        AND sm.status = 'active'
    ) as policy_would_allow
FROM experiments e
WHERE e.site_id = (SELECT site_id FROM test_data)
LIMIT 5;

-- ============================================================================
-- 6. CHECK TABLE STRUCTURE
-- ============================================================================

-- Check if the experiment_segments table has all necessary columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'experiment_segments' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- 7. CHECK FOR ANY TRIGGERS OR CONSTRAINTS
-- ============================================================================

-- Check for triggers that might interfere
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'experiment_segments';

-- Check for foreign key constraints
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'experiment_segments'; 