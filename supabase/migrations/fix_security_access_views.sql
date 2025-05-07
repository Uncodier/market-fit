-- Fix security issues after enabling RLS on all tables and changing view security contexts

-- Primero, eliminar TODAS las políticas que podrían interferir
-- Políticas que dependen de site_direct_ownership_view
DROP POLICY IF EXISTS "Site owners can view site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can add site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can update site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can delete site members" ON public.site_members;

-- Políticas que dependen de site_members_access_view
DROP POLICY IF EXISTS "Users can view their sites and sites they are members of" ON public.sites;
DROP POLICY IF EXISTS "Users can update their sites and sites they administer" ON public.sites;

-- Eliminar las vistas por completo 
DROP VIEW IF EXISTS public.site_direct_ownership_view CASCADE;
DROP VIEW IF EXISTS public.site_members_access_view CASCADE;

-- Eliminar explícitamente la tabla site_membership_access si existe
DROP TABLE IF EXISTS public.site_membership_access CASCADE;

-- Create a stable table version of site_direct_ownership_view to evitar problemas de RLS
CREATE TABLE IF NOT EXISTS public.site_ownership (
  site_id UUID PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Populate the ownership table with current ownership data
INSERT INTO public.site_ownership (site_id, user_id)
SELECT id AS site_id, user_id FROM public.sites
ON CONFLICT (site_id) DO UPDATE SET user_id = EXCLUDED.user_id;

-- Create a trigger to keep site_ownership in sync with sites table
CREATE OR REPLACE FUNCTION sync_site_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.site_ownership(site_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (site_id) DO UPDATE SET user_id = EXCLUDED.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- CASCADE will handle deletion
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_ownership_on_site_change ON public.sites;
CREATE TRIGGER sync_ownership_on_site_change
AFTER INSERT OR UPDATE OF user_id ON public.sites
FOR EACH ROW
EXECUTE FUNCTION sync_site_ownership();

-- Enable RLS on the auxiliary table
ALTER TABLE public.site_ownership ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all authenticated users to see the ownership data
-- This avoids recursion, as we're explicitly allowing access regardless of site ownership
DROP POLICY IF EXISTS "Authenticated users can view site ownership" ON public.site_ownership;
CREATE POLICY "Authenticated users can view site ownership"
ON public.site_ownership
FOR SELECT
TO authenticated
USING (true);

-- Update the sites policies to use the stable table for ownership and direct membership
CREATE POLICY "Users can view their sites and sites they are members of"
ON public.sites
FOR SELECT
USING (
  -- Site creator access (direct ownership via user_id)
  user_id = auth.uid()
  OR
  -- Member access via original site_members table directly
  id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Política UPDATE para sitios
CREATE POLICY "Users can update their sites and sites they administer"
ON public.sites
FOR UPDATE
USING (
  -- Site creator access
  user_id = auth.uid()
  OR
  -- Admin/owner member access via original site_members table
  id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
);

-- Update site_members policies to use the new stable table for the ownership part
CREATE POLICY "Site owners can view site members"
ON public.site_members
FOR SELECT
USING (
  -- Direct site ownership from new stable table
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  -- User should see sites where they are already a member with any role
  (
    user_id = auth.uid() AND 
    role IN ('owner', 'admin', 'marketing', 'collaborator') AND
    status = 'active'
  )
);

CREATE POLICY "Site owners and admins can add site members"
ON public.site_members
FOR INSERT
WITH CHECK (
  -- Direct site ownership from new stable table 
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  -- Only owners/admins can add new members
  EXISTS (
    SELECT 1 FROM public.site_members AS sm
    WHERE 
      sm.site_id = site_members.site_id AND
      sm.user_id = auth.uid() AND
      sm.role IN ('owner', 'admin') AND
      sm.status = 'active'
  )
);

CREATE POLICY "Site owners and admins can update site members"
ON public.site_members
FOR UPDATE
USING (
  -- Direct site ownership from new stable table
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  -- Only owners/admins can update members
  EXISTS (
    SELECT 1 FROM public.site_members AS sm
    WHERE 
      sm.site_id = site_members.site_id AND
      sm.user_id = auth.uid() AND
      sm.role IN ('owner', 'admin') AND
      sm.status = 'active'
  )
);

CREATE POLICY "Site owners and admins can delete site members"
ON public.site_members
FOR DELETE
USING (
  -- Direct site ownership from new stable table
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  -- Only owners/admins can delete members
  EXISTS (
    SELECT 1 FROM public.site_members AS sm
    WHERE 
      sm.site_id = site_members.site_id AND
      sm.user_id = auth.uid() AND
      sm.role IN ('owner', 'admin') AND
      sm.status = 'active'
  )
);

-- Add RLS policies for new tables that had RLS enabled but lack policies
-- Sales
DROP POLICY IF EXISTS "Users can view sales for their sites" ON public.sales;
CREATE POLICY "Users can view sales for their sites"
ON public.sales
FOR SELECT
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can create sales for their sites" ON public.sales;
CREATE POLICY "Users can create sales for their sites"
ON public.sales
FOR INSERT
WITH CHECK (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can update sales for their sites" ON public.sales;
CREATE POLICY "Users can update sales for their sites"
ON public.sales
FOR UPDATE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can delete sales for their sites" ON public.sales;
CREATE POLICY "Users can delete sales for their sites"
ON public.sales
FOR DELETE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
);

-- Campaigns
DROP POLICY IF EXISTS "Users can view campaigns for their sites" ON public.campaigns;
CREATE POLICY "Users can view campaigns for their sites"
ON public.campaigns
FOR SELECT
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can create campaigns for their sites" ON public.campaigns;
CREATE POLICY "Users can create campaigns for their sites"
ON public.campaigns
FOR INSERT
WITH CHECK (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can update campaigns for their sites" ON public.campaigns;
CREATE POLICY "Users can update campaigns for their sites"
ON public.campaigns
FOR UPDATE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can delete campaigns for their sites" ON public.campaigns;
CREATE POLICY "Users can delete campaigns for their sites"
ON public.campaigns
FOR DELETE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
);

-- Transactions
DROP POLICY IF EXISTS "Users can view transactions for their sites" ON public.transactions;
CREATE POLICY "Users can view transactions for their sites"
ON public.transactions
FOR SELECT
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can create transactions for their sites" ON public.transactions;
CREATE POLICY "Users can create transactions for their sites"
ON public.transactions
FOR INSERT
WITH CHECK (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can update transactions for their sites" ON public.transactions;
CREATE POLICY "Users can update transactions for their sites"
ON public.transactions
FOR UPDATE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can delete transactions for their sites" ON public.transactions;
CREATE POLICY "Users can delete transactions for their sites"
ON public.transactions
FOR DELETE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
);

-- Campaign Subtasks
DROP POLICY IF EXISTS "Users can view campaign subtasks for their sites" ON public.campaign_subtasks;
CREATE POLICY "Users can view campaign subtasks for their sites"
ON public.campaign_subtasks
FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can create campaign subtasks for their sites" ON public.campaign_subtasks;
CREATE POLICY "Users can create campaign subtasks for their sites"
ON public.campaign_subtasks
FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can update campaign subtasks for their sites" ON public.campaign_subtasks;
CREATE POLICY "Users can update campaign subtasks for their sites"
ON public.campaign_subtasks
FOR UPDATE
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can delete campaign subtasks for their sites" ON public.campaign_subtasks;
CREATE POLICY "Users can delete campaign subtasks for their sites"
ON public.campaign_subtasks
FOR DELETE
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
      )
  )
);

-- Campaign Segments
DROP POLICY IF EXISTS "Users can view campaign segments for their sites" ON public.campaign_segments;
CREATE POLICY "Users can view campaign segments for their sites"
ON public.campaign_segments
FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can create campaign segments for their sites" ON public.campaign_segments;
CREATE POLICY "Users can create campaign segments for their sites"
ON public.campaign_segments
FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can update campaign segments for their sites" ON public.campaign_segments;
CREATE POLICY "Users can update campaign segments for their sites"
ON public.campaign_segments
FOR UPDATE
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can delete campaign segments for their sites" ON public.campaign_segments;
CREATE POLICY "Users can delete campaign segments for their sites"
ON public.campaign_segments
FOR DELETE
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
      )
  )
);

-- Campaign Requirements
DROP POLICY IF EXISTS "Users can view campaign requirements for their sites" ON public.campaign_requirements;
CREATE POLICY "Users can view campaign requirements for their sites"
ON public.campaign_requirements
FOR SELECT
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can create campaign requirements for their sites" ON public.campaign_requirements;
CREATE POLICY "Users can create campaign requirements for their sites"
ON public.campaign_requirements
FOR INSERT
WITH CHECK (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can update campaign requirements for their sites" ON public.campaign_requirements;
CREATE POLICY "Users can update campaign requirements for their sites"
ON public.campaign_requirements
FOR UPDATE
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'marketing') AND status = 'active'
      )
  )
);

DROP POLICY IF EXISTS "Users can delete campaign requirements for their sites" ON public.campaign_requirements;
CREATE POLICY "Users can delete campaign requirements for their sites"
ON public.campaign_requirements
FOR DELETE
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE 
      site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
      OR
      site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
      )
  )
);

-- Settings
DROP POLICY IF EXISTS "Users can view settings for their sites" ON public.settings;
CREATE POLICY "Users can view settings for their sites"
ON public.settings
FOR SELECT
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can create settings for their sites" ON public.settings;
CREATE POLICY "Users can create settings for their sites"
ON public.settings
FOR INSERT
WITH CHECK (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can update settings for their sites" ON public.settings;
CREATE POLICY "Users can update settings for their sites"
ON public.settings
FOR UPDATE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can delete settings for their sites" ON public.settings;
CREATE POLICY "Users can delete settings for their sites"
ON public.settings
FOR DELETE
USING (
  site_id IN (SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid())
  OR
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
  )
); 