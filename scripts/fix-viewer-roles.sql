-- ============================================================================
-- FIX VIEWER ROLES SCRIPT
-- ============================================================================
-- This script identifies and fixes users who should have 'marketing' (viewer) role
-- but are incorrectly set as 'collaborator' (editor) role

BEGIN;

-- Step 1: Check current role distribution
SELECT 
    role, 
    COUNT(*) as count,
    CASE 
        WHEN role = 'owner' THEN '✅ Owner (correct)'
        WHEN role = 'admin' THEN '✅ Admin (correct)'
        WHEN role = 'marketing' THEN '✅ Marketing/Viewer (correct)'
        WHEN role = 'collaborator' THEN '⚠️ Collaborator/Editor (might be incorrect if should be viewer)'
        ELSE '❓ Unknown role'
    END as description
FROM site_members 
WHERE status = 'active'
GROUP BY role
ORDER BY role;

-- Step 2: Show detailed breakdown by site
SELECT 
    sm.site_id,
    s.name as site_name,
    sm.email,
    sm.role,
    sm.status,
    CASE 
        WHEN sm.role = 'collaborator' THEN '⚠️ Might need to be changed to marketing if user is viewer'
        WHEN sm.role = 'marketing' THEN '✅ Correct viewer role'
        ELSE '🔍 Check manually'
    END as recommendation
FROM site_members sm
LEFT JOIN sites s ON sm.site_id = s.id
WHERE sm.status = 'active' 
AND sm.role IN ('collaborator', 'marketing')
ORDER BY sm.site_id, sm.role;

-- Step 3: Manual fix for a specific user (UNCOMMENT AND MODIFY AS NEEDED)
-- Replace 'USER_EMAIL' and 'SITE_ID' with actual values
/*
UPDATE site_members 
SET role = 'marketing' 
WHERE email = 'USER_EMAIL' 
AND site_id = 'SITE_ID' 
AND role = 'collaborator';
*/

-- Step 4: Verification query to run after manual fixes
-- This will show the updated role distribution
SELECT 
    'After fix' as status,
    role, 
    COUNT(*) as count
FROM site_members 
WHERE status = 'active'
GROUP BY role
ORDER BY role;

COMMIT;

-- ============================================================================
-- INSTRUCTIONS FOR USE:
-- ============================================================================
-- 1. Run this script to see current role distribution
-- 2. Identify users who should be 'marketing' (viewer) but are 'collaborator' (editor)
-- 3. For each user that needs to be changed, uncomment and modify the UPDATE query
-- 4. Run the verification query to confirm changes
-- 
-- EXAMPLE:
-- If user 'john@example.com' on site 'abc-123' should be viewer:
-- UPDATE site_members 
-- SET role = 'marketing' 
-- WHERE email = 'john@example.com' 
-- AND site_id = 'abc-123' 
-- AND role = 'collaborator';
-- ============================================================================ 