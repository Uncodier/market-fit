-- ============================================================================
-- VERIFY ROLE MAPPING
-- ============================================================================
-- This script helps verify that the role mapping is working correctly

-- Step 1: Check current role distribution
SELECT 
    'Current role distribution' as info,
    role, 
    COUNT(*) as count
FROM site_members 
WHERE status = 'active'
GROUP BY role
ORDER BY role;

-- Step 2: Expected mapping validation
SELECT 
    'Expected frontend to database mapping' as info,
    'view (frontend)' as frontend_role,
    'marketing (database)' as db_role,
    'SELECT only' as permissions
UNION ALL
SELECT 
    '',
    'create (frontend)',
    'collaborator (database)',
    'SELECT, INSERT, UPDATE'
UNION ALL
SELECT 
    '',
    'delete (frontend)',
    'collaborator (database)',
    'SELECT, INSERT, UPDATE'
UNION ALL
SELECT 
    '',
    'admin (frontend)',
    'admin (database)',
    'SELECT, INSERT, UPDATE';

-- Step 3: Check if any users need role correction
SELECT 
    'Users that might need role correction' as info,
    sm.email,
    sm.role as current_db_role,
    sm.status,
    s.name as site_name,
    CASE 
        WHEN sm.role = 'collaborator' THEN 'Might be viewer (should be marketing)'
        WHEN sm.role = 'marketing' THEN 'Correct viewer role'
        ELSE 'OK'
    END as recommendation
FROM site_members sm
LEFT JOIN sites s ON sm.site_id = s.id
WHERE sm.status = 'active' 
ORDER BY sm.site_id, sm.role;

-- Step 4: Check if triggers are working
SELECT 
    'Trigger status check' as info,
    COUNT(*) as trigger_count
FROM information_schema.triggers 
WHERE trigger_name LIKE 'trigger_%_permission_%';

-- Step 5: Test query to validate expected behavior
SELECT 
    'Expected behavior summary' as info,
    role,
    CASE 
        WHEN role = 'owner' THEN 'SELECT, INSERT, UPDATE, DELETE'
        WHEN role = 'admin' THEN 'SELECT, INSERT, UPDATE (no DELETE)'
        WHEN role = 'collaborator' THEN 'SELECT, INSERT, UPDATE (no DELETE)'
        WHEN role = 'marketing' THEN 'SELECT only (no INSERT, UPDATE, DELETE)'
        ELSE 'Unknown'
    END as expected_permissions
FROM (
    SELECT DISTINCT role 
    FROM site_members 
    WHERE status = 'active'
) roles
ORDER BY role; 