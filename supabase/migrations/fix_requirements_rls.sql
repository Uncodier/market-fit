-- Fix requirements RLS policies to work with site_members
-- The current policies only check user_id, but should also allow site members access

-- Drop existing broken policies
DROP POLICY IF EXISTS "Permitir a los usuarios leer sus propios requisitos" ON public.requirements;
DROP POLICY IF EXISTS "Permitir a los usuarios crear sus propios requisitos" ON public.requirements;
DROP POLICY IF EXISTS "Permitir a los usuarios actualizar sus propios requisitos" ON public.requirements;
DROP POLICY IF EXISTS "Permitir a los usuarios eliminar sus propios requisitos" ON public.requirements;

-- Create new policies that consider both direct ownership and site membership

-- SELECT policy - allow viewing requirements for sites you own or are a member of
CREATE POLICY "Users can view requirements for their sites"
ON public.requirements
FOR SELECT
USING (
  -- Direct user ownership (creator of the requirement)
  user_id = auth.uid()
  OR
  -- Site ownership via site_ownership table
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Site membership via site_members table
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- INSERT policy - allow creating requirements for sites you own or are a member of with appropriate permissions
CREATE POLICY "Users can create requirements for their sites"
ON public.requirements
FOR INSERT
WITH CHECK (
  -- Direct site ownership via site_ownership table
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Site membership with creation permissions (owner, admin, marketing)
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'marketing') 
    AND status = 'active'
  )
);

-- UPDATE policy - allow updating requirements for sites you own or are a member of with appropriate permissions
CREATE POLICY "Users can update requirements for their sites"
ON public.requirements
FOR UPDATE
USING (
  -- Direct user ownership (creator of the requirement)
  user_id = auth.uid()
  OR
  -- Site ownership via site_ownership table
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Site membership with update permissions (owner, admin, marketing)
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'marketing') 
    AND status = 'active'
  )
)
WITH CHECK (
  -- Same conditions for the updated data
  -- Direct user ownership (creator of the requirement)
  user_id = auth.uid()
  OR
  -- Site ownership via site_ownership table
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Site membership with update permissions (owner, admin, marketing)
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'marketing') 
    AND status = 'active'
  )
);

-- DELETE policy - allow deleting requirements for sites you own or are an admin/owner member
CREATE POLICY "Users can delete requirements for their sites"
ON public.requirements
FOR DELETE
USING (
  -- Direct user ownership (creator of the requirement)
  user_id = auth.uid()
  OR
  -- Site ownership via site_ownership table
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
  OR
  -- Site membership with delete permissions (only owner, admin)
  site_id IN (
    SELECT site_id FROM public.site_members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  )
);

-- Also fix requirement_segments table policies
DROP POLICY IF EXISTS "Permitir a los usuarios gestionar relaciones de requisitos-segmentos" ON public.requirement_segments;

-- Updated policy for requirement_segments table
CREATE POLICY "Users can manage requirement-segment relationships for their sites"
ON public.requirement_segments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.requirements r
    WHERE r.id = requirement_id
    AND (
      -- Direct user ownership (creator of the requirement)
      r.user_id = auth.uid()
      OR
      -- Site ownership via site_ownership table
      r.site_id IN (
        SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
      )
      OR
      -- Site membership with appropriate permissions
      r.site_id IN (
        SELECT site_id FROM public.site_members
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'marketing') 
        AND status = 'active'
      )
    )
  )
);

-- Note: This migration requires the site_ownership and site_members tables to exist
-- If they don't exist, run the previous migration first 