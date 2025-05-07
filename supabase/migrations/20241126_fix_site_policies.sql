-- Fix policies for sites table to ensure site owners have access to their sites
-- This fixes an issue where site creators lost access after implementing site_members

-- First, create a temporary policy to ensure access during changes
DROP POLICY IF EXISTS "Temporary access policy" ON public.sites;
CREATE POLICY "Temporary access policy" 
ON public.sites 
FOR ALL 
TO authenticated 
USING (true);

-- Fix issue with site_members table: ensure user_id can be null for pending invitations
ALTER TABLE public.site_members ALTER COLUMN user_id DROP NOT NULL;

-- Ensure owner record exists for all sites 
DO $$
BEGIN
  -- For each site
  INSERT INTO public.site_members (site_id, user_id, role, email, name, status)
  SELECT 
    s.id AS site_id,
    s.user_id,
    'owner' AS role,
    u.email,
    p.name,
    'active' AS status
  FROM public.sites s
  JOIN auth.users u ON s.user_id = u.id
  LEFT JOIN public.profiles p ON s.user_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.site_members 
    WHERE site_id = s.id AND user_id = s.user_id AND role = 'owner'
  )
  ON CONFLICT (site_id, user_id) DO UPDATE 
  SET role = 'owner', status = 'active';
END;
$$;

-- Create site_access view to avoid recursion
CREATE OR REPLACE VIEW public.user_site_access AS
SELECT DISTINCT 
  sm.site_id,
  sm.user_id,
  sm.role,
  sm.status
FROM 
  public.site_members sm
WHERE 
  sm.status = 'active';

-- Drop the problematic policies
DROP POLICY IF EXISTS "Site owners and members can view sites" ON public.sites;
DROP POLICY IF EXISTS "Users can view their sites and sites they are members of" ON public.sites;
DROP POLICY IF EXISTS "Users can create sites" ON public.sites;
DROP POLICY IF EXISTS "Users can update their sites" ON public.sites;
DROP POLICY IF EXISTS "Users can update their sites and sites they administer" ON public.sites;
DROP POLICY IF EXISTS "Users can delete their sites" ON public.sites;

-- Create correct policies using the view to avoid recursion
-- Policy for SELECT
CREATE POLICY "Users can view their sites and sites they are members of"
ON public.sites
FOR SELECT
USING (
  -- Site creator access (direct ownership via user_id)
  user_id = auth.uid()
  OR
  -- Member access via the view
  id IN (
    SELECT site_id FROM public.user_site_access
    WHERE user_id = auth.uid()
  )
);

-- Policy for INSERT
CREATE POLICY "Users can create sites"
ON public.sites
FOR INSERT
WITH CHECK (
  -- Only allow users to create sites for themselves
  user_id = auth.uid()
);

-- Policy for UPDATE
CREATE POLICY "Users can update their sites and sites they administer"
ON public.sites
FOR UPDATE
USING (
  -- Site creator access
  user_id = auth.uid()
  OR
  -- Admin/owner member access via the view
  id IN (
    SELECT site_id FROM public.user_site_access
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Policy for DELETE
CREATE POLICY "Users can delete their sites"
ON public.sites
FOR DELETE
USING (
  -- Only the original creator can delete a site
  user_id = auth.uid()
);

-- Drop the temporary policy at the end
DROP POLICY IF EXISTS "Temporary access policy" ON public.sites; 