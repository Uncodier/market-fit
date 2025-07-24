-- Migration: Fix RLS Missing Tables
-- Date: 2024-12-19
-- Description: Enable RLS and add policies for tables missing Row Level Security

-- Enable RLS on synced_objects table
ALTER TABLE public.synced_objects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on system_memories table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_memories') THEN
        ALTER TABLE public.system_memories ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Enable RLS on whatsapp_templates table
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- ================================
-- POLICIES FOR SYNCED_OBJECTS
-- ================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can insert synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can update synced objects for their sites" ON public.synced_objects;
DROP POLICY IF EXISTS "Users can delete synced objects for their sites" ON public.synced_objects;

-- Policy for SELECT on synced_objects
CREATE POLICY "Users can view synced objects for their sites" ON public.synced_objects
    FOR SELECT
    USING (
        -- Site members access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = synced_objects.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- Policy for INSERT on synced_objects
CREATE POLICY "Users can insert synced objects for their sites" ON public.synced_objects
    FOR INSERT
    WITH CHECK (
        -- Site admin/owner access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = synced_objects.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
            AND sm.role IN ('owner', 'admin')
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- Policy for UPDATE on synced_objects
CREATE POLICY "Users can update synced objects for their sites" ON public.synced_objects
    FOR UPDATE
    USING (
        -- Site admin/owner access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = synced_objects.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
            AND sm.role IN ('owner', 'admin')
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- Policy for DELETE on synced_objects
CREATE POLICY "Users can delete synced objects for their sites" ON public.synced_objects
    FOR DELETE
    USING (
        -- Site admin/owner access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = synced_objects.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
            AND sm.role IN ('owner', 'admin')
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- ================================
-- POLICIES FOR WHATSAPP_TEMPLATES
-- ================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can create whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can update whatsapp templates for their sites" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates;

-- Policy for SELECT on whatsapp_templates
CREATE POLICY "Users can view whatsapp templates for their sites" ON public.whatsapp_templates
    FOR SELECT
    USING (
        -- Site members access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = whatsapp_templates.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- Policy for INSERT on whatsapp_templates
CREATE POLICY "Users can create whatsapp templates for their sites" ON public.whatsapp_templates
    FOR INSERT
    WITH CHECK (
        -- Site admin/owner/marketing access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = whatsapp_templates.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
            AND sm.role IN ('owner', 'admin', 'marketing')
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- Policy for UPDATE on whatsapp_templates
CREATE POLICY "Users can update whatsapp templates for their sites" ON public.whatsapp_templates
    FOR UPDATE
    USING (
        -- Site admin/owner/marketing access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = whatsapp_templates.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
            AND sm.role IN ('owner', 'admin', 'marketing')
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- Policy for DELETE on whatsapp_templates
CREATE POLICY "Users can delete whatsapp templates for their sites" ON public.whatsapp_templates
    FOR DELETE
    USING (
        -- Site admin/owner access
        EXISTS (
            SELECT 1 FROM public.site_members sm
            WHERE sm.site_id = whatsapp_templates.site_id
            AND sm.user_id = (SELECT auth.uid())
            AND sm.status = 'active'
            AND sm.role IN ('owner', 'admin')
        )
        OR
        -- Admin role access
        (SELECT auth.jwt() ->> 'role') = 'anon'
        OR
        -- Service role access
        (SELECT auth.jwt() ->> 'role') = 'service_role'
    );

-- ================================
-- POLICIES FOR SYSTEM_MEMORIES (if exists)
-- ================================

-- Only create policies if the table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_memories') THEN
        
        -- Drop existing policies first
        EXECUTE 'DROP POLICY IF EXISTS "Users can view system memories for their sites" ON public.system_memories';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create system memories for their sites" ON public.system_memories';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update system memories for their sites" ON public.system_memories';
        EXECUTE 'DROP POLICY IF EXISTS "Users can delete system memories for their sites" ON public.system_memories';
        
        -- Policy for SELECT on system_memories
        EXECUTE 'CREATE POLICY "Users can view system memories for their sites" ON public.system_memories
            FOR SELECT
            USING (
                -- Site members access
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                )
                OR
                -- Admin role access
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                -- Service role access
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        -- Policy for INSERT on system_memories
        EXECUTE 'CREATE POLICY "Users can create system memories for their sites" ON public.system_memories
            FOR INSERT
            WITH CHECK (
                -- Site admin/owner access
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                    AND sm.role IN (''owner'', ''admin'')
                )
                OR
                -- Admin role access
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                -- Service role access
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        -- Policy for UPDATE on system_memories
        EXECUTE 'CREATE POLICY "Users can update system memories for their sites" ON public.system_memories
            FOR UPDATE
            USING (
                -- Site admin/owner access
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                    AND sm.role IN (''owner'', ''admin'')
                )
                OR
                -- Admin role access
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                -- Service role access
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

        -- Policy for DELETE on system_memories
        EXECUTE 'CREATE POLICY "Users can delete system memories for their sites" ON public.system_memories
            FOR DELETE
            USING (
                -- Site admin/owner access
                EXISTS (
                    SELECT 1 FROM public.site_members sm
                    WHERE sm.site_id = system_memories.site_id
                    AND sm.user_id = (SELECT auth.uid())
                    AND sm.status = ''active''
                    AND sm.role IN (''owner'', ''admin'')
                )
                OR
                -- Admin role access
                (SELECT auth.jwt() ->> ''role'') = ''anon''
                OR
                -- Service role access
                (SELECT auth.jwt() ->> ''role'') = ''service_role''
            )';

    END IF;
END $$;

-- ================================
-- GRANT PERMISSIONS
-- ================================

-- Grant necessary permissions for authenticated and anon users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.synced_objects TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated, anon;

-- Grant permissions for system_memories if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_memories') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_memories TO authenticated, anon;
    END IF;
END $$;

-- ================================
-- REFRESH SCHEMA CACHE
-- ================================

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema'; 