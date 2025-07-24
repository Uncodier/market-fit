-- CREATE MISSING PREVENT_LAST_ADMIN_ROLE_CHANGE FUNCTION
-- This migration fixes the error: relation "site_members" does not exist in function prevent_last_admin_role_change
-- Date: 2025-01-24
-- Description: Creates only the missing function since site_members table already exists

-- ============================================================================
-- STEP 1: CREATE PREVENT_LAST_ADMIN_ROLE_CHANGE FUNCTION
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
    -- Get the site_id from the operation
    site_id_to_check := COALESCE(NEW.site_id, OLD.site_id);
    
    -- Only check if changing from admin/owner to another role
    IF OLD.role IN ('admin', 'owner') AND NEW.role NOT IN ('admin', 'owner') THEN
        -- Count remaining admins/owners after this change
        SELECT COUNT(*) INTO admin_count
        FROM public.site_members 
        WHERE site_id = site_id_to_check 
        AND role IN ('admin', 'owner')
        AND id != NEW.id
        AND status = 'active';
        
        -- Prevent if this would leave no admins/owners
        IF admin_count = 0 THEN
            RAISE EXCEPTION 'Cannot change role of the last admin or owner. At least one admin or owner must remain for the site.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add function documentation
COMMENT ON FUNCTION public.prevent_last_admin_role_change() IS 
'Trigger function that prevents changing the role of the last admin or owner in a site. 
Ensures at least one admin or owner remains for site management.';

-- ============================================================================
-- STEP 2: CREATE PREVENT_LAST_ADMIN_DELETION FUNCTION (if not exists)
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

-- Add function documentation
COMMENT ON FUNCTION public.prevent_last_admin_deletion() IS 
'Trigger function that prevents deletion of the last admin or owner in a site.
Allows deletion during site deletion process but blocks individual deletions that would leave no admins.';

-- ============================================================================
-- STEP 3: CREATE TRIGGERS (if not exist)
-- ============================================================================

-- Trigger for role changes
DROP TRIGGER IF EXISTS prevent_last_admin_role_change_trigger ON public.site_members;
CREATE TRIGGER prevent_last_admin_role_change_trigger
    BEFORE UPDATE ON public.site_members
    FOR EACH ROW
    WHEN (OLD.role IS DISTINCT FROM NEW.role)
    EXECUTE FUNCTION prevent_last_admin_role_change();

-- Trigger for deletions
DROP TRIGGER IF EXISTS prevent_last_admin_deletion_trigger ON public.site_members;
CREATE TRIGGER prevent_last_admin_deletion_trigger
    BEFORE DELETE ON public.site_members
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_admin_deletion();

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    function_exists BOOLEAN;
    role_trigger_exists BOOLEAN;
    delete_trigger_exists BOOLEAN;
BEGIN
    -- Check functions
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name = 'prevent_last_admin_role_change'
    ) INTO function_exists;
    
    -- Check triggers
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' AND trigger_name = 'prevent_last_admin_role_change_trigger'
    ) INTO role_trigger_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' AND trigger_name = 'prevent_last_admin_deletion_trigger'
    ) INTO delete_trigger_exists;
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION RESULTS:';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ prevent_last_admin_role_change function: %', CASE WHEN function_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '✅ Role change trigger: %', CASE WHEN role_trigger_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '✅ Delete protection trigger: %', CASE WHEN delete_trigger_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE '==========================================';
    
    IF function_exists AND role_trigger_exists AND delete_trigger_exists THEN
        RAISE NOTICE '🎉 ALL FUNCTIONS AND TRIGGERS CREATED SUCCESSFULLY!';
        RAISE NOTICE 'The "site_members does not exist" error should now be resolved.';
    ELSE
        RAISE NOTICE '⚠️ Some components are missing. Please check the logs above.';
    END IF;
END $$; 