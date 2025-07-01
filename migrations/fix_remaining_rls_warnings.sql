-- Fix Remaining RLS Performance Warnings Migration
-- This covers all remaining tables from the Supabase linter warnings

-- Fix AGENTS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios agentes" ON agents;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios agentes" ON agents;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios agentes" ON agents;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios agentes" ON agents;

CREATE POLICY "agents_unified" ON agents FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = agents.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix EXPERIMENTS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios experimentos" ON experiments;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios experimentos" ON experiments;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios experimentos" ON experiments;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios experimentos" ON experiments;

CREATE POLICY "experiments_unified" ON experiments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = experiments.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix KPIS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios KPIs" ON kpis;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios KPIs" ON kpis;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios KPIs" ON kpis;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios KPIs" ON kpis;

CREATE POLICY "kpis_unified" ON kpis FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = kpis.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix EXPERIMENT_SEGMENTS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones de experimentos-se" ON experiment_segments;

CREATE POLICY "experiment_segments_unified" ON experiment_segments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM experiments e
    JOIN sites s ON s.id = e.site_id
    WHERE e.id = experiment_segments.experiment_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix ASSETS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios assets" ON assets;
DROP POLICY IF EXISTS "Permitir a los usuarios crear assets en sus sitios" ON assets;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios assets" ON assets;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios assets" ON assets;

CREATE POLICY "assets_unified" ON assets FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = assets.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix NOTIFICATIONS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propias notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios crear notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propias notificaciones" ON notifications;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propias notificaciones" ON notifications;

CREATE POLICY "notifications_unified" ON notifications FOR ALL USING (user_id = (select auth.uid()));

-- Fix EXTERNAL_RESOURCES table policies
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios recursos externo" ON external_resources;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios recursos externos" ON external_resources;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios recursos externos" ON external_resources;
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios recursos externos" ON external_resources;

CREATE POLICY "external_resources_unified" ON external_resources FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = external_resources.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix DEBUG_LOGS table policies
DROP POLICY IF EXISTS "select_debug_logs" ON debug_logs;

CREATE POLICY "debug_logs_unified" ON debug_logs FOR SELECT USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = debug_logs.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix ANALYSIS table policies
DROP POLICY IF EXISTS "Users can delete their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can insert their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can update their own analyses" ON analysis;
DROP POLICY IF EXISTS "Users can view their own analyses" ON analysis;

CREATE POLICY "analysis_unified" ON analysis FOR ALL USING (user_id = (select auth.uid()));

-- Fix TASKS table policies
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;

CREATE POLICY "tasks_unified" ON tasks FOR ALL USING (user_id = (select auth.uid()));

-- Fix CAMPAIGNS table policies
DROP POLICY IF EXISTS "Users can create campaigns for their sites" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns for their sites" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns for their sites" ON campaigns;
DROP POLICY IF EXISTS "Users can view campaigns for their sites" ON campaigns;

CREATE POLICY "campaigns_unified" ON campaigns FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = campaigns.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix TRANSACTIONS table policies
DROP POLICY IF EXISTS "Users can create transactions for their sites" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions for their sites" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions for their sites" ON transactions;
DROP POLICY IF EXISTS "Users can view transactions for their sites" ON transactions;

CREATE POLICY "transactions_unified" ON transactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = transactions.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix CAMPAIGN_SUBTASKS table policies
DROP POLICY IF EXISTS "Users can create campaign subtasks for their sites" ON campaign_subtasks;
DROP POLICY IF EXISTS "Users can delete campaign subtasks for their sites" ON campaign_subtasks;
DROP POLICY IF EXISTS "Users can update campaign subtasks for their sites" ON campaign_subtasks;
DROP POLICY IF EXISTS "Users can view campaign subtasks for their sites" ON campaign_subtasks;

CREATE POLICY "campaign_subtasks_unified" ON campaign_subtasks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN sites s ON s.id = c.site_id
    WHERE c.id = campaign_subtasks.campaign_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix CAMPAIGN_SEGMENTS table policies
DROP POLICY IF EXISTS "Users can create campaign segments for their sites" ON campaign_segments;
DROP POLICY IF EXISTS "Users can delete campaign segments for their sites" ON campaign_segments;
DROP POLICY IF EXISTS "Users can update campaign segments for their sites" ON campaign_segments;
DROP POLICY IF EXISTS "Users can view campaign segments for their sites" ON campaign_segments;

CREATE POLICY "campaign_segments_unified" ON campaign_segments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM campaigns c
    JOIN sites s ON s.id = c.site_id
    WHERE c.id = campaign_segments.campaign_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix SALES table policies
DROP POLICY IF EXISTS "Users can create sales for their sites" ON sales;
DROP POLICY IF EXISTS "Users can delete sales for their sites" ON sales;
DROP POLICY IF EXISTS "Users can update sales for their sites" ON sales;
DROP POLICY IF EXISTS "Users can view sales for their sites" ON sales;

CREATE POLICY "sales_unified" ON sales FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = sales.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix COMMANDS table policies
DROP POLICY IF EXISTS "Users can insert their own commands" ON commands;
DROP POLICY IF EXISTS "Users can update their own commands" ON commands;
DROP POLICY IF EXISTS "Users can view their own commands" ON commands;

CREATE POLICY "commands_unified" ON commands FOR ALL USING (user_id = (select auth.uid()));

-- Fix SETTINGS table policies
DROP POLICY IF EXISTS "Users can create settings for their sites" ON settings;
DROP POLICY IF EXISTS "Users can delete settings for their sites" ON settings;
DROP POLICY IF EXISTS "Users can update settings for their sites" ON settings;
DROP POLICY IF EXISTS "Users can view settings for their sites" ON settings;

CREATE POLICY "settings_unified" ON settings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = settings.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix BILLING table policies
DROP POLICY IF EXISTS "billing_user_policy" ON billing;

CREATE POLICY "billing_unified" ON billing FOR ALL USING (user_id = (select auth.uid()));

-- Fix AGENT_ASSETS table policies
DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones entre agentes y as" ON agent_assets;

CREATE POLICY "agent_assets_unified" ON agent_assets FOR ALL USING (
  EXISTS (
    SELECT 1 FROM agents a
    JOIN sites s ON s.id = a.site_id
    WHERE a.id = agent_assets.agent_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix SALE_ORDERS table policies
DROP POLICY IF EXISTS "Users can delete their own sale orders" ON sale_orders;
DROP POLICY IF EXISTS "Users can insert their own sale orders" ON sale_orders;
DROP POLICY IF EXISTS "Users can update their own sale orders" ON sale_orders;
DROP POLICY IF EXISTS "Users can view their own sale orders" ON sale_orders;

CREATE POLICY "sale_orders_unified" ON sale_orders FOR ALL USING (user_id = (select auth.uid()));

-- Fix SITE_MEMBERS table policies
DROP POLICY IF EXISTS "Add site members" ON site_members;
DROP POLICY IF EXISTS "Allow cascade deletions from auth.users" ON site_members;
DROP POLICY IF EXISTS "Update site members" ON site_members;
DROP POLICY IF EXISTS "View site members" ON site_members;

CREATE POLICY "site_members_unified" ON site_members FOR ALL USING (
  user_id = (select auth.uid()) OR
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = site_members.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()) AND sm.role IN ('admin', 'owner'))
    )
  )
);

-- Fix SECURE_TOKENS table policies
DROP POLICY IF EXISTS "Users can delete their own tokens" ON secure_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON secure_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON secure_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON secure_tokens;

CREATE POLICY "secure_tokens_unified" ON secure_tokens FOR ALL USING (user_id = (select auth.uid()));

-- Fix SITE_OWNERSHIP table policies
DROP POLICY IF EXISTS "Authenticated users can insert site ownership" ON site_ownership;
DROP POLICY IF EXISTS "Users can delete their own site ownership" ON site_ownership;
DROP POLICY IF EXISTS "Users can update their own site ownership" ON site_ownership;

CREATE POLICY "site_ownership_unified" ON site_ownership FOR ALL USING (user_id = (select auth.uid()));

-- Fix CATEGORIES table policies
DROP POLICY IF EXISTS "Users can create categories for their sites" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can view their own site's categories" ON categories;

CREATE POLICY "categories_unified" ON categories FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = categories.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix ALLOWED_DOMAINS table policies
DROP POLICY IF EXISTS "Only owners and admins can delete allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can insert allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can update allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Users can view allowed domains for their sites" ON allowed_domains;

CREATE POLICY "allowed_domains_unified" ON allowed_domains FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = allowed_domains.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix API_KEYS table policies
DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;

CREATE POLICY "api_keys_unified" ON api_keys FOR ALL USING (user_id = (select auth.uid()));

-- Fix REFERRAL_CODE_USES table policies
DROP POLICY IF EXISTS "Permitir insertar uso de código de referido" ON referral_code_uses;
DROP POLICY IF EXISTS "Permitir ver propios usos de código de referido" ON referral_code_uses;

CREATE POLICY "referral_code_uses_unified" ON referral_code_uses FOR ALL USING (
  user_id = (select auth.uid()) OR referred_user_id = (select auth.uid())
);

-- Fix COMPANIES table policies
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;

CREATE POLICY "companies_unified" ON companies FOR ALL USING ((select auth.uid()) IS NOT NULL);

-- Fix REQUIREMENTS table policies
DROP POLICY IF EXISTS "Users can create requirements for their sites" ON requirements;
DROP POLICY IF EXISTS "Users can delete requirements for their sites" ON requirements;
DROP POLICY IF EXISTS "Users can update requirements for their sites" ON requirements;
DROP POLICY IF EXISTS "Users can view requirements for their sites" ON requirements;

CREATE POLICY "requirements_unified" ON requirements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sites s WHERE s.id = requirements.site_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Fix REQUIREMENT_SEGMENTS table policies
DROP POLICY IF EXISTS "Users can manage requirement-segment relationships for their si" ON requirement_segments;

CREATE POLICY "requirement_segments_unified" ON requirement_segments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM requirements r
    JOIN sites s ON s.id = r.site_id
    WHERE r.id = requirement_segments.requirement_id AND (
      s.user_id = (select auth.uid()) OR
      EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
    )
  )
);

-- Add additional performance indexes for remaining tables
CREATE INDEX IF NOT EXISTS idx_perf_agents_site_id ON agents(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_experiments_site_id ON experiments(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_kpis_site_id ON kpis(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_experiment_segments_experiment_id ON experiment_segments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_perf_assets_site_id ON assets(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_external_resources_site_id ON external_resources(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_debug_logs_user_id ON debug_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_debug_logs_site_id ON debug_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_analysis_user_id ON analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_transactions_site_id ON transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_campaign_subtasks_campaign_id ON campaign_subtasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_perf_campaign_segments_campaign_id ON campaign_segments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_perf_sales_site_id ON sales(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_commands_user_id ON commands(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_settings_site_id ON settings(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_billing_user_id ON billing(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_agent_assets_agent_id ON agent_assets(agent_id);
CREATE INDEX IF NOT EXISTS idx_perf_sale_orders_user_id ON sale_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_site_members_user_id ON site_members(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_secure_tokens_user_id ON secure_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_site_ownership_user_id ON site_ownership(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_categories_site_id ON categories(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_allowed_domains_site_id ON allowed_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_referral_code_uses_user_id ON referral_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_perf_referral_code_uses_referred_user_id ON referral_code_uses(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_perf_requirements_site_id ON requirements(site_id);
CREATE INDEX IF NOT EXISTS idx_perf_requirement_segments_requirement_id ON requirement_segments(requirement_id);

SELECT 'Remaining RLS performance warnings fixed successfully' AS status; 