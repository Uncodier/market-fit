-- Create enum type for campaign status
CREATE TYPE campaign_status AS ENUM (
  'active',
  'pending',
  'completed'
);

-- Create enum type for campaign priority
CREATE TYPE campaign_priority AS ENUM (
  'high',
  'medium',
  'low'
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority campaign_priority NOT NULL DEFAULT 'medium',
  status campaign_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  assignees INTEGER DEFAULT 0,
  issues INTEGER DEFAULT 0,
  revenue JSONB DEFAULT '{"actual": 0, "projected": 0, "estimated": 0, "currency": "USD"}',
  budget JSONB DEFAULT '{"allocated": 0, "remaining": 0, "currency": "USD"}',
  type TEXT NOT NULL,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create transactions table for campaign costs
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'variable')),
  amount DECIMAL NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  currency TEXT DEFAULT 'USD',
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create campaign subtasks
CREATE TABLE IF NOT EXISTS public.campaign_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'in-progress', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create relation table between campaigns and segments
CREATE TABLE IF NOT EXISTS public.campaign_segments (
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.segments(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, segment_id)
);

-- Create relation table between campaigns and requirements
CREATE TABLE IF NOT EXISTS public.campaign_requirements (
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, requirement_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_site_id ON public.campaigns(site_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority ON public.campaigns(priority);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.campaigns(type);

CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON public.transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_site_id ON public.transactions(site_id);

CREATE INDEX IF NOT EXISTS idx_campaign_subtasks_campaign_id ON public.campaign_subtasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_subtasks_status ON public.campaign_subtasks(status); 