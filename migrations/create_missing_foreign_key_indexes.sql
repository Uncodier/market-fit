-- Migration: Create missing foreign key indexes
-- Description: Adds indexes for all unindexed foreign keys to improve query performance
-- Date: 2025-01-30

-- Agents table indexes
CREATE INDEX IF NOT EXISTS idx_agents_supervisor ON public.agents(supervisor);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);

-- Campaign segments table indexes
CREATE INDEX IF NOT EXISTS idx_campaign_segments_segment_id ON public.campaign_segments(segment_id);

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);

-- Commands table indexes
CREATE INDEX IF NOT EXISTS idx_commands_site_id ON public.commands(site_id);

-- Content table indexes
CREATE INDEX IF NOT EXISTS idx_content_author_id ON public.content(author_id);
CREATE INDEX IF NOT EXISTS idx_content_segment_id ON public.content(segment_id);
CREATE INDEX IF NOT EXISTS idx_content_site_id ON public.content(site_id);
CREATE INDEX IF NOT EXISTS idx_content_user_id ON public.content(user_id);

-- Conversations table indexes
CREATE INDEX IF NOT EXISTS idx_conversations_delegate_id ON public.conversations(delegate_id);

-- Experiment segments table indexes
CREATE INDEX IF NOT EXISTS idx_experiment_segments_segment_id ON public.experiment_segments(segment_id);

-- Experiments table indexes
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON public.experiments(user_id);

-- KPIs table indexes
CREATE INDEX IF NOT EXISTS idx_kpis_segment_id ON public.kpis(segment_id);
CREATE INDEX IF NOT EXISTS idx_kpis_user_id ON public.kpis(user_id);

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_site_id ON public.notifications(site_id);

-- Referral codes table indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_created_by ON public.referral_codes(created_by);

-- Requirement segments table indexes
CREATE INDEX IF NOT EXISTS idx_requirement_segments_segment_id ON public.requirement_segments(segment_id);

-- Requirements table indexes
CREATE INDEX IF NOT EXISTS idx_requirements_user_id ON public.requirements(user_id);

-- Sales table indexes
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);

-- Segments table indexes
CREATE INDEX IF NOT EXISTS idx_segments_user_id ON public.segments(user_id);

-- Session events table indexes
CREATE INDEX IF NOT EXISTS idx_session_events_segment_id ON public.session_events(segment_id);

-- Site members table indexes
CREATE INDEX IF NOT EXISTS idx_site_members_added_by ON public.site_members(added_by);

-- Site ownership table indexes
CREATE INDEX IF NOT EXISTS idx_site_ownership_user_id ON public.site_ownership(user_id);

-- Sites table indexes
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON public.sites(user_id);

-- Tasks table indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- Visitors table indexes
CREATE INDEX IF NOT EXISTS idx_visitors_campaign_id ON public.visitors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_visitors_segment_id ON public.visitors(segment_id);

-- Add comments for documentation
COMMENT ON INDEX idx_agents_supervisor IS 'Index for agents supervisor foreign key';
COMMENT ON INDEX idx_agents_user_id IS 'Index for agents user_id foreign key';
COMMENT ON INDEX idx_campaign_segments_segment_id IS 'Index for campaign_segments segment_id foreign key';
COMMENT ON INDEX idx_campaigns_user_id IS 'Index for campaigns user_id foreign key';
COMMENT ON INDEX idx_commands_site_id IS 'Index for commands site_id foreign key';
COMMENT ON INDEX idx_content_author_id IS 'Index for content author_id foreign key';
COMMENT ON INDEX idx_content_segment_id IS 'Index for content segment_id foreign key';
COMMENT ON INDEX idx_content_site_id IS 'Index for content site_id foreign key';
COMMENT ON INDEX idx_content_user_id IS 'Index for content user_id foreign key';
COMMENT ON INDEX idx_conversations_delegate_id IS 'Index for conversations delegate_id foreign key';
COMMENT ON INDEX idx_experiment_segments_segment_id IS 'Index for experiment_segments segment_id foreign key';
COMMENT ON INDEX idx_experiments_user_id IS 'Index for experiments user_id foreign key';
COMMENT ON INDEX idx_kpis_segment_id IS 'Index for kpis segment_id foreign key';
COMMENT ON INDEX idx_kpis_user_id IS 'Index for kpis user_id foreign key';
COMMENT ON INDEX idx_leads_campaign_id IS 'Index for leads campaign_id foreign key';
COMMENT ON INDEX idx_leads_user_id IS 'Index for leads user_id foreign key';
COMMENT ON INDEX idx_notifications_site_id IS 'Index for notifications site_id foreign key';
COMMENT ON INDEX idx_referral_codes_created_by IS 'Index for referral_codes created_by foreign key';
COMMENT ON INDEX idx_requirement_segments_segment_id IS 'Index for requirement_segments segment_id foreign key';
COMMENT ON INDEX idx_requirements_user_id IS 'Index for requirements user_id foreign key';
COMMENT ON INDEX idx_sales_user_id IS 'Index for sales user_id foreign key';
COMMENT ON INDEX idx_segments_user_id IS 'Index for segments user_id foreign key';
COMMENT ON INDEX idx_session_events_segment_id IS 'Index for session_events segment_id foreign key';
COMMENT ON INDEX idx_site_members_added_by IS 'Index for site_members added_by foreign key';
COMMENT ON INDEX idx_site_ownership_user_id IS 'Index for site_ownership user_id foreign key';
COMMENT ON INDEX idx_sites_user_id IS 'Index for sites user_id foreign key';
COMMENT ON INDEX idx_tasks_assignee IS 'Index for tasks assignee foreign key';
COMMENT ON INDEX idx_tasks_user_id IS 'Index for tasks user_id foreign key';
COMMENT ON INDEX idx_transactions_user_id IS 'Index for transactions user_id foreign key';
COMMENT ON INDEX idx_visitors_campaign_id IS 'Index for visitors campaign_id foreign key';
COMMENT ON INDEX idx_visitors_segment_id IS 'Index for visitors segment_id foreign key'; 