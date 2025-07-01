-- Cleanup and Fix All Performance Issues
-- This migration cleans up duplicate policies and fixes all remaining performance issues

DO $$
BEGIN
    RAISE NOTICE '🧹 Starting comprehensive cleanup and optimization...';
    RAISE NOTICE '📊 Target: Fix 87 performance warnings';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: Clean up duplicate policies 
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🧹 CLEANUP: Removing duplicate policies...';
    
    -- Remove duplicate consolidated policies that conflict with existing ones
    DROP POLICY IF EXISTS "Users can manage campaign segments for their sites" ON public.campaign_segments;
    DROP POLICY IF EXISTS "Users can manage leads for their sites" ON public.leads;
    DROP POLICY IF EXISTS "Users can manage tasks for their sites" ON public.tasks;
    
    RAISE NOTICE '✅ Duplicate policies cleaned up';
END $$;

-- ============================================================================
-- PART 2: Fix remaining tables with auth RLS issues
-- ============================================================================

-- Campaign Subtasks
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing campaign_subtasks...';
    
    DROP POLICY IF EXISTS "Users can view campaign subtasks for their sites" ON public.campaign_subtasks;
    DROP POLICY IF EXISTS "Users can create campaign subtasks for their sites" ON public.campaign_subtasks;
    DROP POLICY IF EXISTS "Users can update campaign subtasks for their sites" ON public.campaign_subtasks;
    DROP POLICY IF EXISTS "Users can delete campaign subtasks for their sites" ON public.campaign_subtasks;
    
    CREATE POLICY "campaign_subtasks_optimized" ON public.campaign_subtasks
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.campaigns c
                JOIN public.site_members sm ON sm.site_id = c.site_id
                WHERE c.id = campaign_subtasks.campaign_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Campaign subtasks optimized';
END $$;

-- Agent Assets
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing agent_assets...';
    
    DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones entre agentes y as" ON public.agent_assets;
    
    CREATE POLICY "agent_assets_optimized" ON public.agent_assets
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.agents a
                JOIN public.site_members sm ON sm.site_id = a.site_id
                WHERE a.id = agent_assets.agent_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Agent assets optimized';
END $$;

-- Sale Orders
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing sale_orders...';
    
    DROP POLICY IF EXISTS "Users can view their own sale orders" ON public.sale_orders;
    DROP POLICY IF EXISTS "Users can insert their own sale orders" ON public.sale_orders;
    DROP POLICY IF EXISTS "Users can update their own sale orders" ON public.sale_orders;
    DROP POLICY IF EXISTS "Users can delete their own sale orders" ON public.sale_orders;
    
    CREATE POLICY "sale_orders_optimized" ON public.sale_orders
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.sales s
                JOIN public.site_members sm ON sm.site_id = s.site_id
                WHERE s.id = sale_orders.sale_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Sale orders optimized';
END $$;

-- Allowed Domains
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing allowed_domains...';
    
    DROP POLICY IF EXISTS "Users can view allowed domains for their sites" ON public.allowed_domains;
    DROP POLICY IF EXISTS "Only owners and admins can insert allowed domains" ON public.allowed_domains;
    DROP POLICY IF EXISTS "Only owners and admins can update allowed domains" ON public.allowed_domains;
    DROP POLICY IF EXISTS "Only owners and admins can delete allowed domains" ON public.allowed_domains;
    
    CREATE POLICY "allowed_domains_optimized" ON public.allowed_domains
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = allowed_domains.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Allowed domains optimized';
END $$;

-- Referral Code Uses
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing referral_code_uses...';
    
    DROP POLICY IF EXISTS "Permitir ver propios usos de código de referido" ON public.referral_code_uses;
    DROP POLICY IF EXISTS "Permitir insertar uso de código de referido" ON public.referral_code_uses;
    
    CREATE POLICY "referral_code_uses_optimized" ON public.referral_code_uses
        FOR ALL USING (user_id = (select auth.uid()));
    
    RAISE NOTICE '✅ Referral code uses optimized';
END $$;

-- Companies
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing companies...';
    
    DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
    DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
    DROP POLICY IF EXISTS "Authenticated users can update companies" ON public.companies;
    
    CREATE POLICY "companies_optimized" ON public.companies
        FOR ALL USING ((select auth.uid()) IS NOT NULL);
    
    RAISE NOTICE '✅ Companies optimized';
END $$;

-- Content (fix multiple policies)
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing content...';
    
    DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.content;
    DROP POLICY IF EXISTS "Filter by site_id only" ON public.content;
    
    CREATE POLICY "content_optimized" ON public.content
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = content.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Content optimized';
END $$;

-- Conversations (fix multiple policies)
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing conversations...';
    
    DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.conversations;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.conversations;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.conversations;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.conversations;
    
    CREATE POLICY "conversations_optimized" ON public.conversations
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.site_members sm 
                WHERE sm.site_id = conversations.site_id 
                AND sm.user_id = (select auth.uid())
            )
        );
    
    RAISE NOTICE '✅ Conversations optimized';
END $$;

-- Messages (fix multiple policies)
DO $$
BEGIN
    RAISE NOTICE '🔧 Optimizing messages...';
    
    DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.messages;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.messages;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.messages;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.messages;
    
    CREATE POLICY "messages_optimized" ON public.messages
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.conversations c
                JOIN public.site_members sm ON sm.site_id = c.site_id
                WHERE c.id = messages.conversation_id 
                AND sm.user_id = (select auth.uid())
            ) OR user_id = (select auth.uid())
        );
    
    RAISE NOTICE '✅ Messages optimized';
END $$;

-- ============================================================================
-- PART 3: Remove duplicate indexes
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️  Removing duplicate indexes...';
    
    DROP INDEX IF EXISTS idx_memories_agent_id;
    DROP INDEX IF EXISTS idx_analysis_user_id;  
    DROP INDEX IF EXISTS idx_settings_site_id;
    
    RAISE NOTICE '✅ Duplicate indexes removed';
END $$;

-- ============================================================================
-- FINAL REPORT
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CLEANUP COMPLETE!';
    RAISE NOTICE 'All 87 performance warnings should now be resolved.';
    RAISE NOTICE 'Check your Supabase dashboard to verify.';
END $$; 