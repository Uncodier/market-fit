-- SECURE FIX: Site deletion with proper context management
-- This migration creates a secure way to delete sites without removing all protection

-- ============================================================================
-- STEP 1: CREATE IMPROVED delete_site_safely FUNCTION WITH CONTEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_site_safely(site_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    site_exists BOOLEAN;
    user_is_owner BOOLEAN;
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required: You must be logged in to delete a site';
    END IF;
    
    -- Check if site exists
    SELECT EXISTS (
        SELECT 1 FROM public.sites 
        WHERE id = site_id_param
    ) INTO site_exists;
    
    IF NOT site_exists THEN
        RAISE EXCEPTION 'Site not found';
    END IF;
    
    -- Check if user is the owner of the site
    SELECT EXISTS (
        SELECT 1 FROM public.sites 
        WHERE id = site_id_param 
        AND user_id = current_user_id
    ) INTO user_is_owner;
    
    IF NOT user_is_owner THEN
        RAISE EXCEPTION 'Permission denied: Only the site owner can delete this site';
    END IF;
    
    -- Set context variable to indicate we're in a legitimate site deletion
    PERFORM set_config('app.deleting_site_id', site_id_param::text, true);
    PERFORM set_config('app.deleting_user_id', current_user_id::text, true);
    
    BEGIN
        -- Delete the site (CASCADE will delete related records)
        DELETE FROM public.sites WHERE id = site_id_param;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Clear context on error
            PERFORM set_config('app.deleting_site_id', '', true);
            PERFORM set_config('app.deleting_user_id', '', true);
            RAISE;
    END;
    
    -- Clear the context variables
    PERFORM set_config('app.deleting_site_id', '', true);
    PERFORM set_config('app.deleting_user_id', '', true);
    
    RETURN true;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Ensure context is cleared on any error
        PERFORM set_config('app.deleting_site_id', '', true);
        PERFORM set_config('app.deleting_user_id', '', true);
        RAISE;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public';

-- ============================================================================
-- STEP 2: UPDATE check_delete_permission TO RESPECT SITE DELETION CONTEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_delete_permission()
RETURNS TRIGGER AS $$
DECLARE
    target_site_id UUID;
    current_user_id UUID;
    user_role TEXT;
    is_owner BOOLEAN := FALSE;
    is_admin BOOLEAN := FALSE;
    deleting_site_id TEXT;
    deleting_user_id TEXT;
BEGIN
    -- Get current user
    current_user_id := auth.uid();
    
    -- Skip check for system operations (when no user context)
    IF current_user_id IS NULL THEN
        RETURN OLD;
    END IF;
    
    -- Check if we're in a legitimate site deletion context
    BEGIN
        deleting_site_id := current_setting('app.deleting_site_id', true);
        deleting_user_id := current_setting('app.deleting_user_id', true);
    EXCEPTION
        WHEN OTHERS THEN
            deleting_site_id := '';
            deleting_user_id := '';
    END;
    
    -- Get site_id from the record being deleted
    CASE TG_TABLE_NAME
        WHEN 'sites' THEN
            target_site_id := OLD.id;
            
        WHEN 'task_comments' THEN
            SELECT t.site_id INTO target_site_id
            FROM public.tasks t 
            WHERE t.id = OLD.task_id;
            
        WHEN 'task_categories' THEN
            SELECT t.site_id INTO target_site_id
            FROM public.tasks t 
            WHERE t.id = OLD.task_id;
            
        WHEN 'agent_assets' THEN
            SELECT a.site_id INTO target_site_id
            FROM public.agents a 
            WHERE a.id = OLD.agent_id;
            
        WHEN 'agent_memories' THEN
            SELECT a.site_id INTO target_site_id
            FROM public.agents a 
            WHERE a.id = OLD.agent_id;
            
        WHEN 'campaign_requirements' THEN
            SELECT c.site_id INTO target_site_id
            FROM public.campaigns c 
            WHERE c.id = OLD.campaign_id;
            
        WHEN 'campaign_segments' THEN
            SELECT c.site_id INTO target_site_id
            FROM public.campaigns c 
            WHERE c.id = OLD.campaign_id;
            
        WHEN 'campaign_subtasks' THEN
            SELECT c.site_id INTO target_site_id
            FROM public.campaigns c 
            WHERE c.id = OLD.campaign_id;
            
        WHEN 'experiment_segments' THEN
            SELECT e.site_id INTO target_site_id
            FROM public.experiments e 
            WHERE e.id = OLD.experiment_id;
            
        WHEN 'requirement_segments' THEN
            SELECT r.site_id INTO target_site_id
            FROM public.requirements r 
            WHERE r.id = OLD.requirement_id;
            
        WHEN 'messages' THEN
            SELECT c.site_id INTO target_site_id
            FROM public.conversations c 
            WHERE c.id = OLD.conversation_id;
            
        WHEN 'sale_orders' THEN
            target_site_id := OLD.site_id;
            
        ELSE
            -- Default: assume table has site_id column
            BEGIN
                EXECUTE format('SELECT ($1).site_id') USING OLD INTO target_site_id;
            EXCEPTION
                WHEN OTHERS THEN
                    target_site_id := NULL;
            END;
    END CASE;
    
    -- If we couldn't determine site_id, allow the operation (might be system table)
    IF target_site_id IS NULL THEN
        RETURN OLD;
    END IF;
    
    -- CRITICAL: Check if this deletion is part of a legitimate site deletion
    IF deleting_site_id IS NOT NULL 
       AND deleting_site_id != '' 
       AND deleting_site_id = target_site_id::text
       AND deleting_user_id = current_user_id::text THEN
        -- This is a legitimate site deletion by the site owner
        RETURN OLD;
    END IF;
    
    -- For individual record deletions, check normal permissions
    
    -- Check if user is site owner (fastest check)
    SELECT EXISTS (
        SELECT 1 FROM public.sites 
        WHERE id = target_site_id AND user_id = current_user_id
    ) INTO is_owner;
    
    -- If owner, allow immediately
    IF is_owner THEN
        RETURN OLD;
    END IF;
    
    -- Check if user is admin member
    BEGIN
        SELECT role INTO user_role
        FROM public.site_members 
        WHERE site_id = target_site_id 
        AND user_id = current_user_id 
        AND status = 'active';
        
        is_admin := (user_role = 'admin');
    EXCEPTION
        WHEN undefined_table THEN
            -- site_members table doesn't exist, treat as non-admin
            is_admin := FALSE;
            user_role := 'none';
    END;
    
    -- Allow if admin, block otherwise
    IF is_admin THEN
        RETURN OLD;
    ELSE
        RAISE EXCEPTION 'DELETE_PERMISSION_DENIED: Only site owners and admins can delete records. Your role: none';
    END IF;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public';

-- ============================================================================
-- STEP 3: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.delete_site_safely(UUID) TO authenticated;

-- ============================================================================
-- STEP 4: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.delete_site_safely(UUID) IS 
'Securely deletes a site and all its related data using context variables. Only site owners can delete sites.';

COMMENT ON FUNCTION public.check_delete_permission() IS 
'Enhanced delete protection function that respects site deletion context.';

-- Success message
SELECT 'SITE DELETION FIX APPLIED SUCCESSFULLY' as status; 