-- FIX: Recreate prevent_last_admin_role_change function with correct search_path
-- This fixes the error: relation "site_members" does not exist
-- Problem: The function has search_path="" which prevents it from finding the table
-- Date: 2025-01-24

-- ============================================================================
-- STEP 1: RECREATE THE FUNCTION WITH CORRECT SETTINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_last_admin_role_change()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    admin_count INTEGER;
    site_id_to_check UUID;
BEGIN
    -- Get the site_id from the row being updated
    site_id_to_check := NEW.site_id;
    
    -- Only check if we're changing FROM admin/owner TO something else
    IF OLD.role IN ('admin', 'owner') AND NEW.role NOT IN ('admin', 'owner') THEN
        
        -- Count remaining admins/owners for this site (excluding the one being changed)
        SELECT COUNT(*) INTO admin_count
        FROM public.site_members 
        WHERE site_id = site_id_to_check 
        AND role IN ('admin', 'owner')
        AND id != NEW.id  -- Exclude the member being changed
        AND status = 'active';  -- Only count active members
        
        -- If this would be the last admin/owner, prevent the role change
        IF admin_count = 0 THEN
            RAISE EXCEPTION 'Cannot change role of the last admin or owner. At least one admin or owner must remain for the site.';
        END IF;
    END IF;
    
    -- Allow the role change if there are other admins/owners
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: ALSO FIX prevent_last_admin_deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_last_admin_deletion()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    admin_count INTEGER;
    site_id_to_check UUID;
    deleting_site_id TEXT;
BEGIN
    site_id_to_check := OLD.site_id;
    
    -- Only protect admin/owner deletions
    IF OLD.role NOT IN ('admin', 'owner') THEN
        RETURN OLD;
    END IF;
    
    -- Check if we're deleting the entire site (allow in that case)
    BEGIN
        deleting_site_id := current_setting('app.deleting_site', true);
    EXCEPTION WHEN OTHERS THEN
        deleting_site_id := '';
    END;
    
    -- If we're deleting this site, allow the operation
    IF deleting_site_id = site_id_to_check::text THEN
        RETURN OLD;
    END IF;
    
    -- Count remaining admins after this deletion
    SELECT COUNT(*) INTO admin_count
    FROM public.site_members 
    WHERE site_id = site_id_to_check 
    AND role IN ('admin', 'owner')
    AND id != OLD.id
    AND status = 'active';
    
    -- Prevent if this would leave no admins/owners
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last admin or owner of the site. At least one admin or owner must remain.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    func_info RECORD;
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔧 FUNCTION FIX VERIFICATION';
    RAISE NOTICE '==========================================';
    
    -- Check the fixed function
    SELECT 
        p.proname as function_name,
        p.prosecdef as security_definer,
        p.proconfig as config_settings
    INTO func_info
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'prevent_last_admin_role_change';
    
    RAISE NOTICE '✅ Function: %', func_info.function_name;
    RAISE NOTICE '🔐 Security Definer: %', CASE WHEN func_info.security_definer THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE '🗂️  Search Path Config: %', func_info.config_settings;
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🎉 FUNCTION FIXED! The "site_members does not exist" error should be resolved.';
    RAISE NOTICE '==========================================';
    
END $$; 