-- ============================================================================
-- REMOTE AUTOMATION TABLES CREATION SCRIPT
-- Designed for deployment automation and remote desktop management for AI agents
-- Provider-agnostic infrastructure for remote instance management
-- ============================================================================

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- ============================================================================
-- 1. REMOTE_INSTANCES TABLE
-- Manages remote desktop instances (Ubuntu, Browser, Windows)
-- ============================================================================

CREATE TABLE public.remote_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instance_type text NOT NULL CHECK (instance_type = ANY (ARRAY['ubuntu'::text, 'browser'::text, 'windows'::text])),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'starting'::text, 'running'::text, 'paused'::text, 'stopping'::text, 'stopped'::text, 'error'::text])),
  provider_instance_id text, -- External provider instance ID
  cdp_url text, -- Chrome DevTools Protocol URL (or equivalent) for browser instances
  timeout_hours integer DEFAULT 1,
  
  -- Configuration
  configuration jsonb DEFAULT '{}'::jsonb,
  environment_variables jsonb DEFAULT '{}'::jsonb,
  tools_enabled jsonb DEFAULT '["bash", "computer", "edit"]'::jsonb,
  
  -- Performance metrics
  last_screenshot_at timestamp with time zone,
  last_activity_at timestamp with time zone,
  total_commands_executed integer DEFAULT 0,
  
  -- Costs and billing
  estimated_cost numeric(10,4) DEFAULT 0.0000,
  actual_cost numeric(10,4) DEFAULT 0.0000,
  
  -- Relationships
  site_id uuid NOT NULL,
  user_id uuid NOT NULL,
  agent_id uuid, -- Associated agent (optional)
  command_id uuid, -- Associated command (optional)
  created_by uuid NOT NULL,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  stopped_at timestamp with time zone,
  
  -- Constraints
  CONSTRAINT remote_instances_pkey PRIMARY KEY (id),
  CONSTRAINT remote_instances_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT remote_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT remote_instances_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_command_remote_instances FOREIGN KEY (command_id) REFERENCES public.commands(id) ON DELETE SET NULL,
  CONSTRAINT remote_instances_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. AUTOMATION_AUTH_SESSIONS TABLE  
-- Manages browser authentication sessions for reuse
-- ============================================================================

CREATE TABLE public.automation_auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  
  -- Authentication data
  provider_auth_state_id text, -- Provider auth state ID
  domain text NOT NULL,
  auth_type text NOT NULL CHECK (auth_type = ANY (ARRAY['cookies'::text, 'localStorage'::text, 'sessionStorage'::text, 'credentials'::text, 'oauth'::text])),
  auth_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  browser_type text DEFAULT 'chrome',
  user_agent text,
  viewport jsonb DEFAULT '{"width": 1920, "height": 1080}'::jsonb,
  
  -- Usage tracking
  last_used_at timestamp with time zone,
  usage_count integer DEFAULT 0,
  is_valid boolean DEFAULT true,
  
  -- Relationships
  site_id uuid NOT NULL,
  user_id uuid NOT NULL,
  instance_id uuid, -- Associated instance (optional)
  created_by uuid NOT NULL,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  
  -- Constraints
  CONSTRAINT automation_auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT automation_auth_sessions_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT automation_auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT automation_auth_sessions_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.remote_instances(id) ON DELETE SET NULL,
  CONSTRAINT automation_auth_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Unique constraint for domain-name combination per site
  CONSTRAINT automation_auth_sessions_site_domain_name_unique UNIQUE (site_id, domain, name)
);

-- ============================================================================
-- 3. INSTANCE_LOGS TABLE
-- Tracks all steps, actions, and interactions within instances
-- ============================================================================

CREATE TABLE public.instance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Log metadata
  log_type text NOT NULL CHECK (log_type = ANY (ARRAY['system'::text, 'user_action'::text, 'agent_action'::text, 'tool_call'::text, 'tool_result'::text, 'error'::text, 'performance'::text])),
  level text NOT NULL DEFAULT 'info' CHECK (level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text, 'critical'::text])),
  
  -- Content
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  
  -- Step tracking (from automation provider SDK)
  step_id text, -- Provider step ID
  tool_name text, -- bash, computer, edit, etc.
  tool_call_id text,
  tool_args jsonb DEFAULT '{}'::jsonb,
  tool_result jsonb DEFAULT '{}'::jsonb,
  is_error boolean DEFAULT false,
  
  -- Performance metrics
  duration_ms integer,
  tokens_used jsonb DEFAULT '{}'::jsonb, -- {promptTokens, completionTokens, totalTokens}
  
  -- Screenshots and artifacts
  screenshot_base64 text, -- Base64 encoded screenshot
  artifacts jsonb DEFAULT '[]'::jsonb, -- Files, images, data generated
  
  -- Relationships
  instance_id uuid NOT NULL,
  site_id uuid NOT NULL,
  user_id uuid, -- Who triggered this (user or agent)
  agent_id uuid, -- Agent responsible for this action
  command_id uuid, -- Associated command
  parent_log_id uuid, -- For nested/related logs
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT instance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT instance_logs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.remote_instances(id) ON DELETE CASCADE,
  CONSTRAINT instance_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT instance_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT instance_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_command_instance_logs FOREIGN KEY (command_id) REFERENCES public.commands(id) ON DELETE SET NULL,
  CONSTRAINT instance_logs_parent_log_id_fkey FOREIGN KEY (parent_log_id) REFERENCES public.instance_logs(id) ON DELETE SET NULL
);

-- ============================================================================
-- 4. INSTANCE_PLANS TABLE
-- Manages objectives, tasks, and verification steps for instances
-- ============================================================================

CREATE TABLE public.instance_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Plan details
  title text NOT NULL,
  description text,
  
  -- Plan type and structure
  plan_type text NOT NULL CHECK (plan_type = ANY (ARRAY['objective'::text, 'task'::text, 'verification'::text, 'milestone'::text])),
  priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'blocked'::text])),
  
  -- Content and instructions
  instructions text,
  expected_output text,
  success_criteria jsonb DEFAULT '[]'::jsonb,
  validation_rules jsonb DEFAULT '[]'::jsonb,
  
  -- Execution details
  tools_required jsonb DEFAULT '[]'::jsonb,
  estimated_duration_minutes integer,
  actual_duration_minutes integer,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  -- Steps and artifacts
  steps jsonb DEFAULT '[]'::jsonb, -- Array of step objects with id, title, description, status
  artifacts jsonb DEFAULT '[]'::jsonb,
  error_message text,
  
  -- Progress tracking
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  steps_completed integer DEFAULT 0,
  steps_total integer DEFAULT 1,
  
  -- Relationships and hierarchy
  instance_id uuid NOT NULL,
  site_id uuid NOT NULL,
  user_id uuid NOT NULL,
  agent_id uuid, -- Agent assigned to execute this plan
  command_id uuid, -- Associated command
  parent_plan_id uuid, -- For sub-tasks
  
  -- Dependencies
  depends_on jsonb DEFAULT '[]'::jsonb, -- Array of plan IDs this depends on
  blocks jsonb DEFAULT '[]'::jsonb, -- Array of plan IDs this blocks
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  due_at timestamp with time zone,
  
  -- Constraints
  CONSTRAINT instance_plans_pkey PRIMARY KEY (id),
  CONSTRAINT instance_plans_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.remote_instances(id) ON DELETE CASCADE,
  CONSTRAINT instance_plans_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
  CONSTRAINT instance_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT instance_plans_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_command_instance_plans FOREIGN KEY (command_id) REFERENCES public.commands(id) ON DELETE SET NULL,
  CONSTRAINT instance_plans_parent_plan_id_fkey FOREIGN KEY (parent_plan_id) REFERENCES public.instance_plans(id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE OPTIMIZATION
-- Following existing application patterns
-- ============================================================================

-- remote_instances indexes
CREATE INDEX idx_remote_instances_site_id ON public.remote_instances(site_id);
CREATE INDEX idx_remote_instances_user_id ON public.remote_instances(user_id);
CREATE INDEX idx_remote_instances_agent_id ON public.remote_instances(agent_id);
CREATE INDEX idx_remote_instances_command_id ON public.remote_instances(command_id);
CREATE INDEX idx_remote_instances_status ON public.remote_instances(status);
CREATE INDEX idx_remote_instances_instance_type ON public.remote_instances(instance_type);
CREATE INDEX idx_remote_instances_created_at ON public.remote_instances(created_at);
CREATE INDEX idx_remote_instances_last_activity_at ON public.remote_instances(last_activity_at);
CREATE INDEX idx_remote_instances_provider_instance_id ON public.remote_instances(provider_instance_id);

-- automation_auth_sessions indexes
CREATE INDEX idx_automation_auth_sessions_site_id ON public.automation_auth_sessions(site_id);
CREATE INDEX idx_automation_auth_sessions_user_id ON public.automation_auth_sessions(user_id);
CREATE INDEX idx_automation_auth_sessions_instance_id ON public.automation_auth_sessions(instance_id);
CREATE INDEX idx_automation_auth_sessions_domain ON public.automation_auth_sessions(domain);
CREATE INDEX idx_automation_auth_sessions_auth_type ON public.automation_auth_sessions(auth_type);
CREATE INDEX idx_automation_auth_sessions_is_valid ON public.automation_auth_sessions(is_valid);
CREATE INDEX idx_automation_auth_sessions_last_used_at ON public.automation_auth_sessions(last_used_at);
CREATE INDEX idx_automation_auth_sessions_expires_at ON public.automation_auth_sessions(expires_at);

-- instance_logs indexes
CREATE INDEX idx_instance_logs_instance_id ON public.instance_logs(instance_id);
CREATE INDEX idx_instance_logs_site_id ON public.instance_logs(site_id);
CREATE INDEX idx_instance_logs_user_id ON public.instance_logs(user_id);
CREATE INDEX idx_instance_logs_agent_id ON public.instance_logs(agent_id);
CREATE INDEX idx_instance_logs_command_id ON public.instance_logs(command_id);
CREATE INDEX idx_instance_logs_log_type ON public.instance_logs(log_type);
CREATE INDEX idx_instance_logs_level ON public.instance_logs(level);
CREATE INDEX idx_instance_logs_tool_name ON public.instance_logs(tool_name);
CREATE INDEX idx_instance_logs_created_at ON public.instance_logs(created_at);
CREATE INDEX idx_instance_logs_step_id ON public.instance_logs(step_id);
CREATE INDEX idx_instance_logs_is_error ON public.instance_logs(is_error);

-- instance_plans indexes
CREATE INDEX idx_instance_plans_instance_id ON public.instance_plans(instance_id);
CREATE INDEX idx_instance_plans_site_id ON public.instance_plans(site_id);
CREATE INDEX idx_instance_plans_user_id ON public.instance_plans(user_id);
CREATE INDEX idx_instance_plans_agent_id ON public.instance_plans(agent_id);
CREATE INDEX idx_instance_plans_command_id ON public.instance_plans(command_id);
CREATE INDEX idx_instance_plans_plan_type ON public.instance_plans(plan_type);
CREATE INDEX idx_instance_plans_status ON public.instance_plans(status);
CREATE INDEX idx_instance_plans_priority ON public.instance_plans(priority);
CREATE INDEX idx_instance_plans_parent_plan_id ON public.instance_plans(parent_plan_id);
CREATE INDEX idx_instance_plans_created_at ON public.instance_plans(created_at);
CREATE INDEX idx_instance_plans_due_at ON public.instance_plans(due_at);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Following existing application patterns using site_ownership
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.remote_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR remote_instances
-- ============================================================================

CREATE POLICY "remote_instances_access_policy" ON public.remote_instances
    FOR ALL USING (
        -- Site owners can manage all instances
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = remote_instances.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Active site members can view instances
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = remote_instances.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    ) WITH CHECK (
        -- Only site owners can create/modify instances
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = remote_instances.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- RLS POLICIES FOR automation_auth_sessions
-- ============================================================================

CREATE POLICY "automation_auth_sessions_access_policy" ON public.automation_auth_sessions
    FOR ALL USING (
        -- Site owners can manage all auth sessions
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = automation_auth_sessions.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Active site members can view auth sessions
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = automation_auth_sessions.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    ) WITH CHECK (
        -- Only site owners can create/modify auth sessions
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = automation_auth_sessions.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- RLS POLICIES FOR instance_logs
-- ============================================================================

CREATE POLICY "instance_logs_access_policy" ON public.instance_logs
    FOR ALL USING (
        -- Site owners can manage all logs
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = instance_logs.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Active site members can view logs
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = instance_logs.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    ) WITH CHECK (
        -- Site owners and members can create logs (for system integration)
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = instance_logs.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = instance_logs.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    );

-- ============================================================================
-- RLS POLICIES FOR instance_plans
-- ============================================================================

CREATE POLICY "instance_plans_access_policy" ON public.instance_plans
    FOR ALL USING (
        -- Site owners can manage all plans
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = instance_plans.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
        OR
        -- Active site members can view plans
        EXISTS (
            SELECT 1 FROM public.site_members 
            WHERE site_members.site_id = instance_plans.site_id 
            AND site_members.user_id = (SELECT auth.uid())
            AND site_members.status = 'active'
        )
    ) WITH CHECK (
        -- Only site owners can create/modify plans
        EXISTS (
            SELECT 1 FROM public.site_ownership 
            WHERE site_ownership.site_id = instance_plans.site_id 
            AND site_ownership.user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- 7. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_remote_instances_updated_at 
    BEFORE UPDATE ON public.remote_instances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_auth_sessions_updated_at 
    BEFORE UPDATE ON public.automation_auth_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instance_plans_updated_at 
    BEFORE UPDATE ON public.instance_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.remote_instances IS 'Remote desktop instances for AI agents (Ubuntu, Browser, Windows)';
COMMENT ON TABLE public.automation_auth_sessions IS 'Browser authentication sessions for reuse across instances';
COMMENT ON TABLE public.instance_logs IS 'Detailed logs of all actions, tool calls, and results within instances';
COMMENT ON TABLE public.instance_plans IS 'Objectives, tasks, and verification steps for instance execution';

-- ============================================================================
-- 9. VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT 
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename = 'remote_instances' 
     OR tablename = 'automation_auth_sessions' 
     OR tablename = 'instance_logs' 
     OR tablename = 'instance_plans')
ORDER BY tablename;

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename = 'remote_instances' 
     OR tablename = 'automation_auth_sessions' 
     OR tablename = 'instance_logs' 
     OR tablename = 'instance_plans')
ORDER BY tablename;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (tablename = 'remote_instances' 
     OR tablename = 'automation_auth_sessions' 
     OR tablename = 'instance_logs' 
     OR tablename = 'instance_plans')
ORDER BY tablename, indexname;

-- Success message
SELECT 'Remote automation tables created successfully! 🚀' AS status,
       'Tables: remote_instances, automation_auth_sessions, instance_logs, instance_plans' AS details;