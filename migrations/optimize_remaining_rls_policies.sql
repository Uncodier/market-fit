-- Complete RLS Optimization Migration - Part 2
-- Covers remaining tables from the Supabase linter warnings

-- ===================================================================
-- LEADS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- REQUIREMENTS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- REQUIREMENT SEGMENTS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- AGENTS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- EXPERIMENTS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- KPIS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- EXPERIMENT SEGMENTS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones de experimentos-se" ON experiment_segments;

CREATE POLICY "experiment_segments_optimized_policy" ON experiment_segments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN sites s ON s.id = e.site_id
    WHERE e.id = experiment_segments.experiment_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ===================================================================
-- ASSETS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- NOTIFICATIONS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propias notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios crear notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propias notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propias notificaciones" ON notifications;

CREATE POLICY "notifications_optimized_policy" ON notifications
FOR ALL USING (user_id = (select auth.uid()));

-- ===================================================================
-- EXTERNAL RESOURCES TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- DEBUG LOGS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- ANALYSIS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can delete their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can insert their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can update their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can view their own analyses" ON analysis;

CREATE POLICY "analysis_optimized_policy" ON analysis
FOR ALL USING (user_id = (select auth.uid()));

-- ===================================================================
-- TASKS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;

CREATE POLICY "tasks_optimized_policy" ON tasks
FOR ALL USING (user_id = (select auth.uid()));

-- ===================================================================
-- CAMPAIGNS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- TRANSACTIONS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can create transactions for their sites" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions for their sites" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions for their sites" ON transactions;
DROP POLICY IF EXISTS "Users can view transactions for their sites" ON transactions;

CREATE POLICY "transactions_optimized_policy" ON transactions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = transactions.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ===================================================================
-- CAMPAIGN SUBTASKS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can create campaign subtasks for their sites" ON campaign_subtasks;
DROP POLICY IF EXISTS "Users can delete campaign subtasks for their sites" ON campaign_subtasks;
DROP POLICY IF EXISTS "Users can update campaign subtasks for their sites" ON campaign_subtasks;
DROP POLICY IF EXISTS "Users can view campaign subtasks for their sites" ON campaign_subtasks;

CREATE POLICY "campaign_subtasks_optimized_policy" ON campaign_subtasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN sites s ON s.id = c.site_id
    WHERE c.id = campaign_subtasks.campaign_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ===================================================================
-- CAMPAIGN SEGMENTS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can create campaign segments for their sites" ON campaign_segments;
DROP POLICY IF EXISTS "Users can delete campaign segments for their sites" ON campaign_segments;
DROP POLICY IF EXISTS "Users can update campaign segments for their sites" ON campaign_segments;
DROP POLICY IF EXISTS "Users can view campaign segments for their sites" ON campaign_segments;

CREATE POLICY "campaign_segments_optimized_policy" ON campaign_segments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN sites s ON s.id = c.site_id
    WHERE c.id = campaign_segments.campaign_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ===================================================================
-- SALES TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can create sales for their sites" ON sales;
DROP POLICY IF EXISTS "Users can delete sales for their sites" ON sales;
DROP POLICY IF EXISTS "Users can update sales for their sites" ON sales;
DROP POLICY IF EXISTS "Users can view sales for their sites" ON sales;

CREATE POLICY "sales_optimized_policy" ON sales
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = sales.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ===================================================================
-- COMMANDS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can insert their own commands" ON commands;
DROP POLICY IF EXISTS "Users can update their own commands" ON commands;
DROP POLICY IF EXISTS "Users can view their own commands" ON commands;

CREATE POLICY "commands_optimized_policy" ON commands
FOR ALL USING (user_id = (select auth.uid()));

-- ===================================================================
-- SETTINGS TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- BILLING TABLE OPTIMIZATIONS
-- ===================================================================

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

-- ===================================================================
-- CONVERSATIONS & MESSAGES TABLE OPTIMIZATIONS
-- ===================================================================

-- Fix multiple permissive policies for conversations
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON conversations;

CREATE POLICY "conversations_optimized_policy" ON conversations
FOR ALL USING ((select auth.uid()) IS NOT NULL);

-- Fix multiple permissive policies for messages
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON messages;

CREATE POLICY "messages_optimized_policy" ON messages
FOR ALL USING ((select auth.uid()) IS NOT NULL);

-- ===================================================================
-- CONTENT TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Allow all authenticated users full access" ON content;
DROP POLICY IF EXISTS "Filter by site_id only" ON content;

CREATE POLICY "content_optimized_policy" ON content
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = content.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ===================================================================
-- TASK CATEGORIES TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Users can manage their own task categories" ON task_categories;
DROP POLICY IF EXISTS "Users can view their own task categories" ON task_categories;

CREATE POLICY "task_categories_optimized_policy" ON task_categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_categories.task_id AND t.user_id = (select auth.uid())
  )
);

-- ===================================================================
-- TASK COMMENTS TABLE OPTIMIZATIONS
-- ===================================================================

DROP POLICY IF EXISTS "Permitir a los usuarios leer comentarios de sus tareas o tareas" ON task_comments;
DROP POLICY IF EXISTS "Users can view comments on tasks they have access to" ON task_comments;
DROP POLICY IF EXISTS "Users can create comments on tasks they have access to" ON task_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON task_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON task_comments;

CREATE POLICY "task_comments_optimized_policy" ON task_comments
FOR ALL USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_comments.task_id AND t.user_id = (select auth.uid())
  )
);

-- ===================================================================
-- ADDITIONAL POLICY OPTIMIZATIONS
-- ===================================================================

-- AGENT ASSETS TABLE
DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones entre agentes y as" ON agent_assets;

CREATE POLICY "agent_assets_optimized_policy" ON agent_assets
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM agents a
    JOIN sites s ON s.id = a.site_id
    WHERE a.id = agent_assets.agent_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- SALE ORDERS TABLE
DROP POLICY IF EXISTS "Users can delete their own sale orders" ON sale_orders;
DROP POLICY IF EXISTS "Users can insert their own sale orders" ON sale_orders;
DROP POLICY IF EXISTS "Users can update their own sale orders" ON sale_orders;
DROP POLICY IF EXISTS "Users can view their own sale orders" ON sale_orders;

CREATE POLICY "sale_orders_optimized_policy" ON sale_orders
FOR ALL USING (user_id = (select auth.uid()));

-- SITE MEMBERS TABLE
DROP POLICY IF EXISTS "Add site members" ON site_members;
DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON site_members;
DROP POLICY IF EXISTS "Update site members" ON site_members;
DROP POLICY IF EXISTS "View site members" ON site_members;

CREATE POLICY "site_members_optimized_policy" ON site_members
FOR ALL USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = site_members.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()) AND sm.role IN ('admin', 'owner')
      )
    )
  )
);

-- SECURE TOKENS TABLE
DROP POLICY IF EXISTS "Users can delete their own tokens" ON secure_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON secure_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON secure_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON secure_tokens;

CREATE POLICY "secure_tokens_optimized_policy" ON secure_tokens
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = secure_tokens.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- SITE OWNERSHIP TABLE
DROP POLICY IF EXISTS "Authenticated users can insert site ownership" ON site_ownership;
DROP POLICY IF EXISTS "Users can delete their own site ownership" ON site_ownership;
DROP POLICY IF EXISTS "Users can update their own site ownership" ON site_ownership;

CREATE POLICY "site_ownership_optimized_policy" ON site_ownership
FOR ALL USING (user_id = (select auth.uid()));

-- CATEGORIES TABLE
DROP POLICY IF EXISTS "Users can create categories for their sites" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can view their own site's categories" ON categories;

CREATE POLICY "categories_optimized_policy" ON categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = categories.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- ALLOWED DOMAINS TABLE
DROP POLICY IF EXISTS "Only owners and admins can delete allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can insert allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can update allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Users can view allowed domains for their sites" ON allowed_domains;

CREATE POLICY "allowed_domains_optimized_policy" ON allowed_domains
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s 
    WHERE s.id = allowed_domains.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (
        SELECT 1 FROM site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid())
      )
    )
  )
);

-- API KEYS TABLE
DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;

CREATE POLICY "api_keys_optimized_policy" ON api_keys
FOR ALL USING (user_id = (select auth.uid()));

-- REFERRAL CODE USES TABLE
DROP POLICY IF EXISTS "Permitir insertar uso de código de referido" ON referral_code_uses;
DROP POLICY IF EXISTS "Permitir ver propios usos de código de referido" ON referral_code_uses;

CREATE POLICY "referral_code_uses_optimized_policy" ON referral_code_uses
FOR ALL USING (
  user_id = (select auth.uid()) OR
  referred_user_id = (select auth.uid())
);

-- COMPANIES TABLE
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;

CREATE POLICY "companies_optimized_policy" ON companies
FOR ALL USING ((select auth.uid()) IS NOT NULL);

-- ===================================================================
-- PERFORMANCE INDEXES
-- ===================================================================

-- Add additional performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_site_id ON leads(site_id);
CREATE INDEX IF NOT EXISTS idx_requirements_site_id ON requirements(site_id);
CREATE INDEX IF NOT EXISTS idx_requirement_segments_requirement_id ON requirement_segments(requirement_id);
CREATE INDEX IF NOT EXISTS idx_experiments_site_id ON experiments(site_id);
CREATE INDEX IF NOT EXISTS idx_kpis_site_id ON kpis(site_id);
CREATE INDEX IF NOT EXISTS idx_experiment_segments_experiment_id ON experiment_segments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets(site_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_external_resources_site_id ON external_resources(site_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_user_id ON debug_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_site_id ON debug_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_site_id ON transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_campaign_subtasks_campaign_id ON campaign_subtasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_segments_campaign_id ON campaign_segments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_site_id ON sales(site_id);
CREATE INDEX IF NOT EXISTS idx_commands_user_id ON commands(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_site_id ON settings(site_id);
CREATE INDEX IF NOT EXISTS idx_billing_site_id ON billing(site_id);
CREATE INDEX IF NOT EXISTS idx_content_site_id ON content(site_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_task_id ON task_categories(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_assets_agent_id ON agent_assets(agent_id);
CREATE INDEX IF NOT EXISTS idx_sale_orders_user_id ON sale_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_site_members_user_id ON site_members(user_id);
CREATE INDEX IF NOT EXISTS idx_secure_tokens_site_id ON secure_tokens(site_id);
CREATE INDEX IF NOT EXISTS idx_site_ownership_user_id ON site_ownership(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_site_id ON categories(site_id);
CREATE INDEX IF NOT EXISTS idx_allowed_domains_site_id ON allowed_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_uses_user_id ON referral_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_uses_referred_user_id ON referral_code_uses(referred_user_id);

-- Migration completed
SELECT 'RLS Policies optimization (Part 2) completed successfully' AS status; 