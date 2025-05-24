-- Migration: Prevent deletion of last admin/owner
-- This trigger ensures that at least one admin or owner always remains for each site

-- Function to check if deletion would leave no admins/owners
CREATE OR REPLACE FUNCTION prevent_last_admin_deletion()
RETURNS TRIGGER AS $$
DECLARE
    admin_count INTEGER;
    site_id_to_check UUID;
BEGIN
    -- Get the site_id from the row being deleted
    site_id_to_check := OLD.site_id;
    
    -- Only check if the member being deleted is an admin or owner
    IF OLD.role NOT IN ('admin', 'owner') THEN
        RETURN OLD; -- Allow deletion of non-admin roles
    END IF;
    
    -- Count remaining admins/owners for this site (excluding the one being deleted)
    SELECT COUNT(*) INTO admin_count
    FROM site_members 
    WHERE site_id = site_id_to_check 
    AND role IN ('admin', 'owner')
    AND id != OLD.id;  -- Exclude the member being deleted
    
    -- If this would be the last admin/owner, prevent deletion
    IF admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last admin or owner of the site. At least one admin or owner must remain.';
    END IF;
    
    -- Allow deletion if there are other admins/owners
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on site_members table
DROP TRIGGER IF EXISTS prevent_last_admin_deletion_trigger ON site_members;

CREATE TRIGGER prevent_last_admin_deletion_trigger
    BEFORE DELETE ON site_members
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_admin_deletion();

-- Also create a function to check before role changes (demoting last admin)
CREATE OR REPLACE FUNCTION prevent_last_admin_role_change()
RETURNS TRIGGER AS $$
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
        FROM site_members 
        WHERE site_id = site_id_to_check 
        AND role IN ('admin', 'owner')
        AND id != NEW.id;  -- Exclude the member being changed
        
        -- If this would be the last admin/owner, prevent the role change
        IF admin_count = 0 THEN
            RAISE EXCEPTION 'Cannot change role of the last admin or owner. At least one admin or owner must remain for the site.';
        END IF;
    END IF;
    
    -- Allow the role change if there are other admins/owners
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for role changes
DROP TRIGGER IF EXISTS prevent_last_admin_role_change_trigger ON site_members;

CREATE TRIGGER prevent_last_admin_role_change_trigger
    BEFORE UPDATE ON site_members
    FOR EACH ROW
    EXECUTE FUNCTION prevent_last_admin_role_change();

-- Add comments for documentation
COMMENT ON FUNCTION prevent_last_admin_deletion() IS 'Prevents deletion of the last admin or owner from a site';
COMMENT ON FUNCTION prevent_last_admin_role_change() IS 'Prevents changing the role of the last admin or owner to a non-admin role';
COMMENT ON TRIGGER prevent_last_admin_deletion_trigger ON site_members IS 'Ensures at least one admin/owner remains when deleting members';
COMMENT ON TRIGGER prevent_last_admin_role_change_trigger ON site_members IS 'Ensures at least one admin/owner remains when changing roles'; 