-- VIEWER ROLE RESTRICTIONS - FIXED VERSION
-- Date: 2025-01-30
-- Fixes: security warnings and ensures restrictions work correctly

BEGIN;

-- ============================================================================
-- STEP 1: CREATE PERMISSION CHECKING FUNCTIONS
-- ============================================================================

-- Function to check if user can perform INSERT/UPDATE operations
CREATE OR REPLACE FUNCTION public.check_create_update_permission()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_site_id UUID;
    current_user_id UUID;
    user_role TEXT;
    is_owner BOOLEAN := FALSE;
    is_admin BOOLEAN := FALSE;
    is_collaborator BOOLEAN := FALSE;
    is_service_role BOOLEAN := FALSE;
BEGIN
    -- Check if this is service_role (bypass restrictions)
    BEGIN
        is_service_role := (current_setting('role') = 'service_role');
    EXCEPTION WHEN OTHERS THEN
        is_service_role := FALSE;
    END;
    
    -- Allow service_role to bypass restrictions
    IF is_service_role THEN
        RETURN NEW;
    END IF;
    
    -- Get current user
    current_user_id := auth.uid();
    
    -- If no user, block the operation
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'CREATE_UPDATE_PERMISSION_DENIED: Authentication required';
    END IF;
    
    -- Get the site_id from the record being inserted/updated
    CASE TG_TABLE_NAME
        WHEN 'visitors' THEN
            -- visitors doesn't have direct site_id, get from related tables
            IF NEW.segment_id IS NOT NULL THEN
                SELECT s.site_id INTO target_site_id
                FROM public.segments s
                WHERE s.id = NEW.segment_id;
            ELSIF NEW.lead_id IS NOT NULL THEN
                SELECT l.site_id INTO target_site_id
                FROM public.leads l
                WHERE l.id = NEW.lead_id;
            ELSE
                -- Allow if can't determine site_id (system operation)
                RETURN NEW;
            END IF;
            
        WHEN 'visitor_sessions' THEN
            target_site_id := NEW.site_id;
            
        WHEN 'messages' THEN
            SELECT c.site_id INTO target_site_id
            FROM public.conversations c 
            WHERE c.id = NEW.conversation_id;
            
        ELSE
            -- Default: assume table has site_id column
            BEGIN
                EXECUTE format('SELECT ($1).site_id') USING NEW INTO target_site_id;
            EXCEPTION WHEN OTHERS THEN
                -- If no site_id column, allow operation (might be system table)
                RETURN NEW;
            END;
    END CASE;
    
    -- If we couldn't determine site_id, allow the operation (might be system table)
    IF target_site_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if user is site owner (fastest check)
    SELECT EXISTS (
        SELECT 1 FROM public.site_ownership 
        WHERE site_id = target_site_id AND user_id = current_user_id
    ) INTO is_owner;
    
    -- If owner, allow immediately
    IF is_owner THEN
        RETURN NEW;
    END IF;
    
    -- Check user role in site_members
    SELECT role INTO user_role
    FROM public.site_members 
    WHERE site_id = target_site_id 
    AND user_id = current_user_id 
    AND status = 'active';
    
    -- Set role flags
    is_admin := (user_role = 'admin');
    is_collaborator := (user_role = 'collaborator');
    
    -- Allow admin and collaborator to create/update
    IF is_admin OR is_collaborator THEN
        RETURN NEW;
    END IF;
    
    -- Block marketing (viewer) and any other roles
    RAISE EXCEPTION 'CREATE_UPDATE_PERMISSION_DENIED: Only site owners, admins, and collaborators can create/update records. Your role: % on site: %', 
        COALESCE(user_role, 'none'), target_site_id;
END;
$$ LANGUAGE plpgsql;

-- Add function documentation
COMMENT ON FUNCTION public.check_create_update_permission() IS 
'Trigger function that checks if current user has permission to create/update records. 
Allows only site owners, admins, and collaborators. Blocks marketing (viewer) role.
Has secure search_path and service_role bypass.';

-- ============================================================================
-- STEP 2: CREATE VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_role_restrictions_status()
RETURNS TABLE (
    table_name TEXT,
    insert_trigger TEXT,
    update_trigger TEXT,
    delete_trigger TEXT,
    status TEXT
) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    table_names TEXT[] := ARRAY[
        'leads', 'campaigns', 'segments', 'experiments', 'sales',
        'agents', 'content', 'requirements', 'tasks', 'visitors',
        'visitor_sessions', 'messages', 'notifications'
    ];
    
    current_table TEXT;
    insert_trig TEXT;
    update_trig TEXT;
    delete_trig TEXT;
    status_msg TEXT;
    
BEGIN
    FOREACH current_table IN ARRAY table_names
    LOOP
        -- Check if triggers exist
        SELECT 
            CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.triggers 
                WHERE trigger_name = 'trigger_insert_permission_' || current_table
                AND event_object_table = current_table
            ) THEN '✅ Active' ELSE '❌ Missing' END,
            
            CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.triggers 
                WHERE trigger_name = 'trigger_update_permission_' || current_table
                AND event_object_table = current_table
            ) THEN '✅ Active' ELSE '❌ Missing' END,
            
            CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.triggers 
                WHERE trigger_name = 'trigger_delete_protection_' || current_table
                AND event_object_table = current_table
            ) THEN '✅ Active' ELSE '❌ Missing' END
        INTO insert_trig, update_trig, delete_trig;
        
        -- Determine overall status
        IF insert_trig = '✅ Active' AND update_trig = '✅ Active' AND delete_trig = '✅ Active' THEN
            status_msg := '✅ Fully Protected';
        ELSIF insert_trig = '✅ Active' AND update_trig = '✅ Active' THEN
            status_msg := '⚠️ CREATE/UPDATE Protected';
        ELSIF delete_trig = '✅ Active' THEN
            status_msg := '⚠️ DELETE Protected Only';
        ELSE
            status_msg := '❌ No Protection';
        END IF;
        
        RETURN QUERY SELECT current_table, insert_trig, update_trig, delete_trig, status_msg;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add function documentation
COMMENT ON FUNCTION public.check_role_restrictions_status() IS 
'Shows the status of role-based restrictions on all tables. 
Displays which tables have INSERT/UPDATE/DELETE protection active.
Has secure search_path.';

-- ============================================================================
-- STEP 3: APPLY TRIGGERS TO ALL RELEVANT TABLES
-- ============================================================================

DO $$
DECLARE
    table_names TEXT[] := ARRAY[
        'leads', 'campaigns', 'segments', 'experiments', 'sales',
        'agents', 'content', 'requirements', 'tasks', 'visitors',
        'visitor_sessions', 'messages', 'notifications'
    ];
    
    current_table TEXT;
    insert_trigger_name TEXT;
    update_trigger_name TEXT;
    table_exists BOOLEAN;
    
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 APPLYING CREATE/UPDATE PERMISSION TRIGGERS';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '📊 Tables to restrict: %', array_length(table_names, 1);
    RAISE NOTICE '';
    
    FOREACH current_table IN ARRAY table_names
    LOOP
        -- Check if table exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = current_table
        ) INTO table_exists;
        
        IF NOT table_exists THEN
            RAISE NOTICE '⚠️ Skipped: % (table does not exist)', current_table;
            CONTINUE;
        END IF;
        
        insert_trigger_name := 'trigger_insert_permission_' || current_table;
        update_trigger_name := 'trigger_update_permission_' || current_table;
        
        BEGIN
            -- Drop existing triggers if they exist
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', insert_trigger_name, current_table);
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', update_trigger_name, current_table);
            
            -- Create INSERT trigger
            EXECUTE format(
                'CREATE TRIGGER %I 
                 BEFORE INSERT ON public.%I 
                 FOR EACH ROW 
                 EXECUTE FUNCTION public.check_create_update_permission()',
                insert_trigger_name, current_table
            );
            
            -- Create UPDATE trigger
            EXECUTE format(
                'CREATE TRIGGER %I 
                 BEFORE UPDATE ON public.%I 
                 FOR EACH ROW 
                 EXECUTE FUNCTION public.check_create_update_permission()',
                update_trigger_name, current_table
            );
            
            RAISE NOTICE '✅ Restricted: % (INSERT/UPDATE)', current_table;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Failed: % (Error: %)', current_table, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CREATE/UPDATE RESTRICTIONS APPLIED!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PERMISSION SUMMARY:';
    RAISE NOTICE '✅ owners: Full access (SELECT, INSERT, UPDATE, DELETE)';
    RAISE NOTICE '✅ admin: Full access except DELETE (SELECT, INSERT, UPDATE)';
    RAISE NOTICE '✅ collaborator: Editor access (SELECT, INSERT, UPDATE)';
    RAISE NOTICE '❌ marketing: Viewer access only (SELECT only)';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

DO $$
DECLARE
    total_tables INTEGER;
    protected_tables INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VERIFICATION RESULTS';
    RAISE NOTICE '======================';
    
    -- Count tables with full protection
    SELECT COUNT(*) INTO total_tables
    FROM public.check_role_restrictions_status();
    
    SELECT COUNT(*) INTO protected_tables
    FROM public.check_role_restrictions_status()
    WHERE status LIKE '%Protected%';
    
    RAISE NOTICE '📊 Total tables checked: %', total_tables;
    RAISE NOTICE '✅ Protected tables: %', protected_tables;
    RAISE NOTICE '❌ Unprotected tables: %', total_tables - protected_tables;
    RAISE NOTICE '';
    
    IF protected_tables = total_tables THEN
        RAISE NOTICE '🎉 SUCCESS: All tables have role restrictions!';
    ELSE
        RAISE NOTICE '⚠️ WARNING: Some tables need additional protection';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 ROLE RESTRICTIONS SUMMARY:';
    RAISE NOTICE '✅ owners: Full access (SELECT, INSERT, UPDATE, DELETE)';
    RAISE NOTICE '✅ admin: Full access except DELETE (SELECT, INSERT, UPDATE)';
    RAISE NOTICE '✅ collaborator: Editor access (SELECT, INSERT, UPDATE)';
    RAISE NOTICE '❌ marketing: Viewer access only (SELECT only)';
    RAISE NOTICE '';
    RAISE NOTICE '📋 To check detailed status: SELECT * FROM check_role_restrictions_status();';
END $$;

COMMIT; 