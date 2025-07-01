-- Optimize RLS Policies Migration
-- Fixes performance issues by optimizing auth function calls and consolidating duplicate policies

-- PROFILES TABLE - Consolidate and optimize multiple policies
DROP POLICY IF EXISTS "Allow cascade deletions from auth.users for profiles" ON profiles;
DROP POLICY IF EXISTS "Los perfiles se pueden crear automáticamente" ON profiles;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Los perfiles son visibles para usuarios autenticados" ON profiles;
DROP POLICY IF EXISTS "Permitir a los usuarios leer cualquier perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir sincronización y gestión de perfiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

CREATE POLICY "profiles_select_optimized" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_optimized" ON profiles FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "profiles_update_optimized" ON profiles FOR UPDATE USING (id = (select auth.uid()));
CREATE POLICY "profiles_delete_optimized" ON profiles FOR DELETE USING (id = (select auth.uid()));

-- SITES TABLE - Consolidate multiple permissive policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios sitios" ON sites;
DROP POLICY IF EXISTS "Users can create sites" ON sites;
DROP POLICY IF EXISTS "Users can delete their sites" ON sites;
DROP POLICY IF EXISTS "Users can update their sites and sites they administer" ON sites;
DROP POLICY IF EXISTS "Users can view their sites and sites they are members of" ON sites;

CREATE POLICY "sites_optimized_policy" ON sites
FOR ALL USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM site_members sm 
    WHERE sm.site_id = sites.id AND sm.user_id = (select auth.uid())
  )
);

-- SEGMENTS TABLE - Fix multiple permissive policies
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

CREATE POLICY "segments_optimized_policy" ON segments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = segments.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- AGENT MEMORIES TABLE - Fix multiple permissive policies
DROP POLICY IF EXISTS "agent_memories_service_access" ON agent_memories;
DROP POLICY IF EXISTS "agent_memories_user_isolation" ON agent_memories;

CREATE POLICY "agent_memories_optimized_policy" ON agent_memories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM agents a 
    JOIN sites s ON s.id = a.site_id
    WHERE a.id = agent_memories.agent_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- CAMPAIGN REQUIREMENTS TABLE - Fix multiple permissive policies
DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones de campañas-requi" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can create campaign requirements for their sites" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can delete campaign requirements for their sites" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can update campaign requirements for their sites" ON campaign_requirements;
DROP POLICY IF EXISTS "Users can view campaign requirements for their sites" ON campaign_requirements;

CREATE POLICY "campaign_requirements_optimized_policy" ON campaign_requirements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN sites s ON s.id = c.site_id
    WHERE c.id = campaign_requirements.campaign_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- PAYMENTS TABLE - Fix multiple permissive policies
DROP POLICY IF EXISTS "System can insert payments" ON payments;
DROP POLICY IF EXISTS "Users can view payments for their sites" ON payments;
DROP POLICY IF EXISTS "payments_user_policy" ON payments;

CREATE POLICY "payments_select_optimized" ON payments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = payments.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

CREATE POLICY "payments_insert_optimized" ON payments
FOR INSERT WITH CHECK (true);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_site_members_lookup ON site_members(site_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_segments_site_id ON segments(site_id);
CREATE INDEX IF NOT EXISTS idx_agents_site_id ON agents(site_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_site_id ON campaigns(site_id);
CREATE INDEX IF NOT EXISTS idx_payments_site_id ON payments(site_id);

-- ===================================================================
-- VALIDATION QUERIES
-- ===================================================================

-- Analyze the policies to ensure they're working correctly
-- These queries can be run to validate the optimization

/*
-- Check for remaining multiple permissive policies
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, roles;

-- Check for auth function usage in policies
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
ORDER BY tablename;

-- Performance test queries (run before and after migration)
EXPLAIN ANALYZE SELECT * FROM profiles WHERE id = auth.uid();
EXPLAIN ANALYZE SELECT * FROM sites WHERE user_id = auth.uid();
*/

-- Migration completed successfully
SELECT 'RLS Policies optimization completed' AS status; 