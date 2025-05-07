-- Rename site access views to make their purpose more clear
-- This migration renames views that were created to solve recursion issues in RLS policies

-- First, create new views with clearer names
CREATE OR REPLACE VIEW public.site_members_access_view AS
SELECT DISTINCT 
  sm.site_id,
  sm.user_id,
  sm.role,
  sm.status
FROM 
  public.site_members sm
WHERE 
  sm.status = 'active';
  
CREATE OR REPLACE VIEW public.site_direct_ownership_view AS
SELECT 
  id AS site_id, 
  user_id
FROM 
  public.sites;

-- Update the sites policies to use the new view name
DROP POLICY IF EXISTS "Users can view their sites and sites they are members of" ON public.sites;
CREATE POLICY "Users can view their sites and sites they are members of"
ON public.sites
FOR SELECT
USING (
  -- Site creator access (direct ownership via user_id)
  user_id = auth.uid()
  OR
  -- Member access via the view
  id IN (
    SELECT site_id FROM public.site_members_access_view
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their sites and sites they administer" ON public.sites;
CREATE POLICY "Users can update their sites and sites they administer"
ON public.sites
FOR UPDATE
USING (
  -- Site creator access
  user_id = auth.uid()
  OR
  -- Admin/owner member access via the view
  id IN (
    SELECT site_id FROM public.site_members_access_view
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Update the site_members policies to use the new view name
DROP POLICY IF EXISTS "Site owners can view site members" ON public.site_members;
CREATE POLICY "Site owners can view site members"
ON public.site_members
FOR SELECT
USING (
  -- Direct site ownership from sites table via view
  site_id IN (SELECT site_id FROM public.site_direct_ownership_view WHERE user_id = auth.uid())
  OR
  -- User should see sites where they are already a member with owner/admin role
  (
    user_id = auth.uid() AND 
    role IN ('owner', 'admin', 'marketing', 'collaborator') AND
    status = 'active'
  )
);

DROP POLICY IF EXISTS "Site owners and admins can add site members" ON public.site_members;
CREATE POLICY "Site owners and admins can add site members"
ON public.site_members
FOR INSERT
WITH CHECK (
  -- Direct site ownership from sites table via view
  site_id IN (SELECT site_id FROM public.site_direct_ownership_view WHERE user_id = auth.uid())
  OR
  -- Only owners/admins can add new members
  -- Use subquery pattern to avoid recursion
  EXISTS (
    SELECT 1 FROM public.site_members AS sm
    WHERE 
      sm.site_id = site_id AND
      sm.user_id = auth.uid() AND
      sm.role IN ('owner', 'admin') AND
      sm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Site owners and admins can update site members" ON public.site_members;
CREATE POLICY "Site owners and admins can update site members"
ON public.site_members
FOR UPDATE
USING (
  -- Direct site ownership from sites table via view
  site_id IN (SELECT site_id FROM public.site_direct_ownership_view WHERE user_id = auth.uid())
  OR
  -- Only owners/admins can update members
  -- Use subquery pattern to avoid recursion
  EXISTS (
    SELECT 1 FROM public.site_members AS sm
    WHERE 
      sm.site_id = site_id AND
      sm.user_id = auth.uid() AND
      sm.role IN ('owner', 'admin') AND
      sm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Site owners and admins can delete site members" ON public.site_members;
CREATE POLICY "Site owners and admins can delete site members"
ON public.site_members
FOR DELETE
USING (
  -- Direct site ownership from sites table via view
  site_id IN (SELECT site_id FROM public.site_direct_ownership_view WHERE user_id = auth.uid())
  OR
  -- Only owners/admins can delete members
  -- Use subquery pattern to avoid recursion
  EXISTS (
    SELECT 1 FROM public.site_members AS sm
    WHERE 
      sm.site_id = site_id AND
      sm.user_id = auth.uid() AND
      sm.role IN ('owner', 'admin') AND
      sm.status = 'active'
  )
);

-- Finally, drop the old views (only after all policies are updated)
DROP VIEW IF EXISTS public.user_site_access;
DROP VIEW IF EXISTS public.site_direct_access;

-- Add a comment to document the purpose of these views
COMMENT ON VIEW public.site_members_access_view IS 'Vista que proporciona acceso directo a los miembros activos de un sitio sin recursión. Usada por las políticas RLS de sites.';
COMMENT ON VIEW public.site_direct_ownership_view IS 'Vista que proporciona acceso directo a la relación usuario-sitio para verificar propiedad sin recursión. Usada por las políticas RLS de site_members.'; 