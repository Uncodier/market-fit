-- SAFE RLS Optimization Migration - Part 2
-- This version runs in smaller chunks to avoid deadlocks
-- Run each section separately if deadlocks occur

BEGIN;

-- Set lock timeout to avoid long waits
SET lock_timeout = '30s';

-- ===================================================================
-- BATCH 1: LEADS, REQUIREMENTS, REQUIREMENT_SEGMENTS
-- ===================================================================

-- Fix LEADS table multiple policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios leads" ON leads;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios leads" ON leads;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios leads" ON leads;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios leads" ON leads;
DROP POLICY IF EXISTS "Leads are insertable by authenticated users only" ON leads;
DROP POLICY IF EXISTS "Leads are viewable by authenticated users only" ON leads;
DROP POLICY IF EXISTS "Leads are updatable by authenticated users only" ON leads;

CREATE POLICY "leads_optimized_policy" ON leads
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = leads.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix REQUIREMENTS table policies
DROP POLICY IF EXISTS "Users can create requirements for their sites" ON requirements;
DROP POLICY IF EXISTS "Users can delete requirements for their sites" ON requirements;
DROP POLICY IF EXISTS "Users can update requirements for their sites" ON requirements;
DROP POLICY IF EXISTS "Users can view requirements for their sites" ON requirements;

CREATE POLICY "requirements_optimized_policy" ON requirements
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = requirements.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix REQUIREMENT_SEGMENTS table policies
DROP POLICY IF EXISTS "Users can manage requirement-segment relationships for their si" ON requirement_segments;

CREATE POLICY "requirement_segments_optimized_policy" ON requirement_segments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM requirements r
    JOIN sites s ON s.id = r.site_id
    WHERE r.id = requirement_segments.requirement_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

COMMIT;

-- Add a short delay between batches
SELECT pg_sleep(1);

-- ===================================================================
-- BATCH 2: AGENTS, EXPERIMENTS, KPIS
-- ===================================================================

BEGIN;
SET lock_timeout = '30s';

-- Fix AGENTS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios agentes" ON agents;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios agentes" ON agents;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios agentes" ON agents;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios agentes" ON agents;

CREATE POLICY "agents_optimized_policy" ON agents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = agents.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix EXPERIMENTS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios experimentos" ON experiments;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios experimentos" ON experiments;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios experimentos" ON experiments;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios experimentos" ON experiments;

CREATE POLICY "experiments_optimized_policy" ON experiments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = experiments.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix KPIS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios KPIs" ON kpis;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios KPIs" ON kpis;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios KPIs" ON kpis;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios KPIs" ON kpis;

CREATE POLICY "kpis_optimized_policy" ON kpis
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = kpis.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

COMMIT;

SELECT pg_sleep(1);

-- ===================================================================
-- BATCH 3: ASSETS, NOTIFICATIONS, EXTERNAL_RESOURCES
-- ===================================================================

BEGIN;
SET lock_timeout = '30s';

-- Fix ASSETS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios assets" ON assets;
DROP POLICY IF EXISTS "Permitir a los usuarios crear assets en sus sitios" ON assets;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios assets" ON assets;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios assets" ON assets;

CREATE POLICY "assets_optimized_policy" ON assets
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = assets.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix NOTIFICATIONS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propias notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios crear notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propias notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propias notificaciones" ON notifications;

CREATE POLICY "notifications_optimized_policy" ON notifications
FOR ALL USING (user_id = (select auth.uid()));

-- Fix EXTERNAL_RESOURCES table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios recursos externo" ON external_resources;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios recursos externos" ON external_resources;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios recursos externos" ON external_resources;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios recursos externos" ON external_resources;

CREATE POLICY "external_resources_optimized_policy" ON external_resources
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = external_resources.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

COMMIT;

SELECT pg_sleep(1);

-- ===================================================================
-- BATCH 4: CORE TABLES (ANALYSIS, TASKS, COMMANDS)
-- ===================================================================

BEGIN;
SET lock_timeout = '30s';

-- Fix DEBUG_LOGS table policies
DROP POLICY IF EXISTS "select_debug_logs" ON debug_logs;

CREATE POLICY "debug_logs_optimized_policy" ON debug_logs
FOR SELECT USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = debug_logs.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix ANALYSIS table policies
DROP POLICY IF EXISTS "Users can delete their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can insert their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can update their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can view their own analyses" ON analysis;

CREATE POLICY "analysis_optimized_policy" ON analysis
FOR ALL USING (user_id = (select auth.uid()));

-- Fix TASKS table policies
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;

CREATE POLICY "tasks_optimized_policy" ON tasks
FOR ALL USING (user_id = (select auth.uid()));

-- Fix COMMANDS table policies
DROP POLICY IF EXISTS "Users can insert their own commands" ON commands;
DROP POLICY IF EXISTS "Users can update their own commands" ON commands;
DROP POLICY IF EXISTS "Users can view their own commands" ON commands;

CREATE POLICY "commands_optimized_policy" ON commands
FOR ALL USING (user_id = (select auth.uid()));

COMMIT;

SELECT pg_sleep(1);

-- ===================================================================
-- BATCH 5: SITE-RELATED TABLES
-- ===================================================================

BEGIN;
SET lock_timeout = '30s';

-- Fix CAMPAIGNS table policies
DROP POLICY IF EXISTS "Users can create campaigns for their sites" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns for their sites" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns for their sites" ON campaigns;
DROP POLICY IF EXISTS "Users can view campaigns for their sites" ON campaigns;

CREATE POLICY "campaigns_optimized_policy" ON campaigns
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = campaigns.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix SETTINGS table policies
DROP POLICY IF EXISTS "Users can create settings for their sites" ON settings;
DROP POLICY IF EXISTS "Users can delete settings for their sites" ON settings;
DROP POLICY IF EXISTS "Users can update settings for their sites" ON settings;
DROP POLICY IF EXISTS "Users can view settings for their sites" ON settings;

CREATE POLICY "settings_optimized_policy" ON settings
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = settings.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- Fix BILLING table policies
DROP POLICY IF EXISTS "billing_user_policy" ON billing;

CREATE POLICY "billing_optimized_policy" ON billing
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = billing.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

COMMIT;

SELECT pg_sleep(1);

-- ===================================================================
-- BATCH 6: CREATE ALL INDEXES
-- ===================================================================

BEGIN;
SET lock_timeout = '30s';

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_site_id ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_requirements_site_id ON requirements(site_id);
CREATE INDEX IF NOT EXISTS idx_requirement_segments_requirement_id ON requirement_segments(requirement_id);
CREATE INDEX IF NOT EXISTS idx_experiments_site_id ON experiments(site_id);
CREATE INDEX IF NOT EXISTS idx_kpis_site_id ON kpis(site_id);
CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets(site_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_external_resources_site_id ON external_resources(site_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_user_id ON debug_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_site_id ON debug_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_commands_user_id ON commands(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_site_id ON settings(site_id);
CREATE INDEX IF NOT EXISTS idx_billing_site_id ON billing(site_id);

COMMIT;

-- Migration completed
SELECT 'RLS Policies optimization (Part 2) completed successfully in batches' AS status; 