-- Quick fix for current RLS policy issues
-- This fixes the immediate problems without destructive changes

-- First, ensure site_ownership table exists with current data (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'site_ownership') THEN
        CREATE TABLE public.site_ownership (
          site_id UUID PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        
        -- Populate with current site ownership
        INSERT INTO public.site_ownership (site_id, user_id)
        SELECT id AS site_id, user_id FROM public.sites;
        
        -- Enable RLS
        ALTER TABLE public.site_ownership ENABLE ROW LEVEL SECURITY;
        
        -- Simple policy for site_ownership
        CREATE POLICY "Authenticated users can view site ownership"
        ON public.site_ownership
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END
$$;

-- Drop and recreate site_members policies to eliminate recursion
DROP POLICY IF EXISTS "Site owners can view site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can add site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can update site members" ON public.site_members;
DROP POLICY IF EXISTS "Site owners and admins can delete site members" ON public.site_members;
DROP POLICY IF EXISTS "View site members" ON public.site_members;
DROP POLICY IF EXISTS "Add site members" ON public.site_members;
DROP POLICY IF EXISTS "Update site members" ON public.site_members;
DROP POLICY IF EXISTS "Delete site members" ON public.site_members;

-- Create simple, non-recursive policies for site_members
CREATE POLICY "View site members"
ON public.site_members
FOR SELECT
USING (
  -- Site owner can see all members
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Users can see their own membership records
  user_id = auth.uid()
);

CREATE POLICY "Add site members"
ON public.site_members
FOR INSERT
WITH CHECK (
  -- Only site owners can add members
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Update site members"
ON public.site_members
FOR UPDATE
USING (
  -- Only site owners can update members
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Delete site members"
ON public.site_members
FOR DELETE
USING (
  -- Only site owners can delete members
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

-- Fix profiles policies for the 406 error
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Ensure owner records exist in site_members
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