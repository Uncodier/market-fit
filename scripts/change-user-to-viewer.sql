-- ============================================================================
-- CHANGE USER TO VIEWER ROLE
-- ============================================================================
-- Simple script to change a specific user from 'collaborator' to 'marketing' (viewer)

-- Replace with the actual values from your database
-- USER_ID: 15c9923b-bf95-4cb4-938f-bdc776b0636a (from your result)
-- SITE_ID: Get from your sites table

-- Step 1: Check current role
SELECT 
    sm.user_id,
    sm.email,
    sm.role,
    sm.status,
    s.name as site_name
FROM site_members sm
LEFT JOIN sites s ON sm.site_id = s.id
WHERE sm.user_id = '15c9923b-bf95-4cb4-938f-bdc776b0636a';

-- Step 2: Change role to marketing (viewer)
UPDATE site_members 
SET role = 'marketing'
WHERE user_id = '15c9923b-bf95-4cb4-938f-bdc776b0636a' 
AND role = 'collaborator';

-- Step 3: Verify the change
SELECT 
    sm.user_id,
    sm.email,
    sm.role,
    sm.status,
    s.name as site_name,
    'Role changed to marketing (viewer)' as result
FROM site_members sm
LEFT JOIN sites s ON sm.site_id = s.id
WHERE sm.user_id = '15c9923b-bf95-4cb4-938f-bdc776b0636a';

-- Step 4: Test the restrictions
SELECT 
    'Testing restrictions for user' as test_info,
    CASE 
        WHEN role = 'marketing' THEN '❌ Should NOT be able to CREATE/UPDATE'
        WHEN role = 'collaborator' THEN '✅ Should be able to CREATE/UPDATE'
        ELSE '❓ Unknown expected behavior'
    END as expected_behavior
FROM site_members 
WHERE user_id = '15c9923b-bf95-4cb4-938f-bdc776b0636a'; 