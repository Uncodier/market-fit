-- Final fix for site_members infinite recursion
-- This completely eliminates recursion by using only site_ownership table for permissions

-- First, ensure site_ownership table exists and has current data
CREATE TABLE IF NOT EXISTS public.site_ownership (
  site_id UUID PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Refresh site_ownership data from sites table
DELETE FROM public.site_ownership;
INSERT INTO public.site_ownership (site_id, user_id)
SELECT id AS site_id, user_id FROM public.sites;

-- Enable RLS on site_ownership with simple policy
ALTER TABLE public.site_ownership ENABLE ROW LEVEL SECURITY;

-- Simple policy for site_ownership - no recursion possible
DROP POLICY IF EXISTS "Authenticated users can view site ownership" ON public.site_ownership;
CREATE POLICY "Authenticated users can view site ownership"
ON public.site_ownership
FOR SELECT
TO authenticated
USING (true);

-- Drop ALL existing site_members policies to start fresh
DROP POLICY IF EXISTS "Site owners can view site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can add site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can update site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can delete site members" ON public.site_members;

-- Create completely non-recursive policies for site_members
-- These policies ONLY use site_ownership table - no site_members queries

-- SELECT policy - users can see members of sites they own, or see their own membership
CREATE POLICY "View site members"
ON public.site_members
FOR SELECT
USING (
  -- Site owner can see all members (using site_ownership only)
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Users can see their own membership records
  user_id = auth.uid()
);

-- INSERT policy - only site owners can add members (no site_members queries)
CREATE POLICY "Add site members"
ON public.site_members
FOR INSERT
WITH CHECK (
  -- Only site owners can add members (using site_ownership only)
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

-- UPDATE policy - only site owners can update members (no site_members queries)
CREATE POLICY "Update site members"
ON public.site_members
FOR UPDATE
USING (
  -- Only site owners can update members (using site_ownership only)
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

-- DELETE policy - only site owners can delete members (no site_members queries)
CREATE POLICY "Delete site members"
ON public.site_members
FOR DELETE
USING (
  -- Only site owners can delete members (using site_ownership only)
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

-- Ensure owner records exist in site_members for all sites
INSERT INTO public.site_members (site_id, user_id, role, email, name, status)
SELECT 
  so.site_id,
  so.user_id,
  'owner' AS role,
  u.email,
  COALESCE(p.name, u.email) AS name,
  'active' AS status
FROM public.site_ownership so
JOIN auth.users u ON so.user_id = u.id
LEFT JOIN public.profiles p ON so.user_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_members 
  WHERE site_id = so.site_id AND user_id = so.user_id AND role = 'owner'
)
ON CONFLICT (site_id, user_id) DO UPDATE 
SET role = 'owner', status = 'active';

-- Create or update trigger to keep site_ownership in sync with sites
CREATE OR REPLACE FUNCTION sync_site_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.site_ownership(site_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (site_id) DO UPDATE SET user_id = EXCLUDED.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.site_ownership WHERE site_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_ownership_on_site_change ON public.sites;
CREATE TRIGGER sync_ownership_on_site_change
AFTER INSERT OR UPDATE OF user_id OR DELETE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION sync_site_ownership();

-- Test the policies by checking if there are any recursive queries
-- This comment is for verification: policies should only reference site_ownership, not site_members 