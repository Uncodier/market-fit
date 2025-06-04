-- Admin Utilities for Supabase
-- This file contains utility functions and queries for managing superadmin access

-- ========================================
-- UTILITY FUNCTIONS FOR SUPERADMIN MANAGEMENT
-- ========================================

-- Function to grant superadmin role to a user by email
CREATE OR REPLACE FUNCTION public.grant_superadmin_role(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Find the user by email
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
        RETURN FALSE;
    END IF;
    
    -- Update the user's metadata to include superadmin role
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "superadmin"}'::jsonb
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke superadmin role from a user by email
CREATE OR REPLACE FUNCTION public.revoke_superadmin_role(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Find the user by email
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
        RETURN FALSE;
    END IF;
    
    -- Remove superadmin role from user's metadata
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data - 'role'
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is superadmin by email
CREATE OR REPLACE FUNCTION public.check_user_superadmin_status(user_email TEXT)
RETURNS TABLE(email TEXT, is_superadmin BOOLEAN, role TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.email::TEXT,
        (u.raw_user_meta_data->>'role' = 'superadmin')::BOOLEAN as is_superadmin,
        COALESCE(u.raw_user_meta_data->>'role', 'user')::TEXT as role
    FROM auth.users u
    WHERE u.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- EXAMPLE USAGE QUERIES
-- ========================================

-- Grant superadmin role to a user (replace with actual email)
-- SELECT public.grant_superadmin_role('admin@example.com');

-- Check superadmin status
-- SELECT * FROM public.check_user_superadmin_status('admin@example.com');

-- Revoke superadmin role
-- SELECT public.revoke_superadmin_role('admin@example.com');

-- ========================================
-- TESTING QUERIES
-- ========================================

-- Query to list all current superadmins
-- SELECT 
--     email,
--     raw_user_meta_data->>'role' as role,
--     created_at
-- FROM auth.users 
-- WHERE raw_user_meta_data->>'role' = 'superadmin';

-- Test query to verify RLS policies work
-- (Run these as different users to test access)

-- Test allowed_domains access (should only work for superadmin)
-- SELECT * FROM public.allowed_domains LIMIT 5;

-- Test companies access (should work for any authenticated user)
-- SELECT * FROM public.companies LIMIT 5;

-- Test cron_status access (should only work for superadmin)
-- SELECT * FROM public.cron_status LIMIT 5;

-- ========================================
-- COMMENTS AND DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION public.grant_superadmin_role(TEXT) IS 'Grants superadmin role to a user by email';
COMMENT ON FUNCTION public.revoke_superadmin_role(TEXT) IS 'Revokes superadmin role from a user by email';
COMMENT ON FUNCTION public.check_user_superadmin_status(TEXT) IS 'Checks if a user has superadmin role by email'; 