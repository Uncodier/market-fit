-- Fix RLS Performance Warnings Migration
-- This migration addresses all auth_rls_initplan and multiple_permissive_policies warnings

-- Fix PROFILES table multiple policies
DROP POLICY IF EXISTS "Allow cascade deletions from auth.users for profiles" ON profiles;
DROP POLICY IF EXISTS "Los perfiles se pueden crear automáticamente" ON profiles; 
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Los perfiles son visibles para usuarios autenticados" ON profiles;
DROP POLICY IF EXISTS "Permitir a los usuarios leer cualquier perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir sincronización y gestión de perfiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = (select auth.uid()));
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (id = (select auth.uid()));

-- Fix SITES table multiple policies  
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Users can create sites" ON sites;
DROP POLICY IF EXISTS "Users can delete their sites" ON sites;
DROP POLICY IF EXISTS "Users can update their sites and sites they administer" ON sites;
DROP POLICY IF EXISTS "Users can view their sites and sites they are members of" ON sites;

CREATE POLICY "sites_unified" ON sites FOR ALL USING (
  user_id = (select auth.uid()) OR
  EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = sites.id AND sm.user_id = (select auth.uid()))
);

-- Fix SEGMENTS table multiple policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios segmentos" ON segments;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios segmentos" ON segments;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios segmentos" ON segments;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios segmentos" ON segments;
DROP POLICY IF EXISTS "Users can create segments for their sites" ON segments;
DROP POLICY IF EXISTS "Users can delete segments for their sites" ON segments;
DROP POLICY IF EXISTS "Users can insert their own segments" ON segments;
DROP POLICY IF EXISTS "Users can read their own segments" ON segments;
DROP POLICY IF EXISTS "Users can update segments for their sites" ON segments;
DROP POLICY IF EXISTS "Users can update their own segments" ON segments;
DROP POLICY IF EXISTS "Users can view segments for their sites" ON segments;

CREATE POLICY "segments_unified" ON segments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = segments.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix LEADS table multiple policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios leads" ON leads;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios leads" ON leads;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios leads" ON leads;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios leads" ON leads;
DROP POLICY IF EXISTS "Leads are insertable by authenticated users only" ON leads;
DROP POLICY IF EXISTS "Leads are viewable by authenticated users only" ON leads;
DROP POLICY IF EXISTS "Leads are updatable by authenticated users only" ON leads;

CREATE POLICY "leads_unified" ON leads FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = leads.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix CONVERSATIONS table multiple policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON conversations;

CREATE POLICY "conversations_unified" ON conversations FOR ALL USING ((select auth.uid()) IS NOT NULL);

-- Fix MESSAGES table multiple policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON messages;

CREATE POLICY "messages_unified" ON messages FOR ALL USING ((select auth.uid()) IS NOT NULL);

-- Fix CONTENT table multiple policies
DROP POLICY IF EXISTS "Allow all authenticated users full access" ON content;
DROP POLICY IF EXISTS "Filter by site_id only" ON content;

CREATE POLICY "content_unified" ON content FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = content.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix AGENT_MEMORIES table multiple policies
DROP POLICY IF EXISTS "agent_memories_service_access" ON agent_memories;
DROP POLICY IF EXISTS "agent_memories_user_isolation" ON agent_memories;

CREATE POLICY "agent_memories_unified" ON agent_memories FOR ALL USING (
  EXISTS (
    SELECT 1 FROM agents a 
    JOIN sites s ON s.id = a.site_id
    WHERE a.id = agent_memories.agent_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix CAMPAIGN_REQUIREMENTS table multiple policies
DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones de campañas-requi" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can create campaign requirements for their sites" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can delete campaign requirements for their sites" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can update campaign requirements for their sites" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can view campaign requirements for their sites" ON campaign_requirements;

CREATE POLICY "campaign_requirements_unified" ON campaign_requirements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN sites s ON s.id = c.site_id
    WHERE c.id = campaign_requirements.campaign_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix PAYMENTS table multiple policies
DROP POLICY IF EXISTS "System can insert payments" ON payments;
DROP POLICY IF EXISTS "Users can view payments for their sites" ON payments;
DROP POLICY IF EXISTS "payments_user_policy" ON payments;

CREATE POLICY "payments_select_unified" ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = payments.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

CREATE POLICY "payments_insert_unified" ON payments FOR INSERT WITH CHECK (true);

-- Fix TASK_CATEGORIES table multiple policies
DROP POLICY IF EXISTS "Users can manage their own task categories" ON task_categories;
DROP POLICY IF EXISTS "Users can view their own task categories" ON task_categories;

CREATE POLICY "task_categories_unified" ON task_categories FOR ALL USING (user_id = (select auth.uid()));

-- Fix TASK_COMMENTS table multiple policies
DROP POLICY IF EXISTS "Permitir a los usuarios leer comentarios de sus tareas o tareas" ON task_comments;
DROP POLICY IF EXISTS "Users can view comments on tasks they have access to" ON task_comments;
DROP POLICY IF EXISTS "Users can create comments on tasks they have access to" ON task_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON task_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON task_comments;

CREATE POLICY "task_comments_unified" ON task_comments FOR ALL USING (
  user_id = (select auth.uid()) OR
  EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id AND t.user_id = (select auth.uid()))
);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_perf_site_members_lookup ON site_members(site_id, user_id);
CREATE INDEX IF NOT EXISTS idx_perf_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_segments_site_id ON segments(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_leads_site_id ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_agents_site_id ON agents(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_campaigns_site_id ON campaigns(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_payments_site_id ON payments(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_content_site_id ON content(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_perf_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_perf_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_task_categories_user_id ON task_categories(user_id);

SELECT 'RLS performance warnings fixed successfully' AS status; 