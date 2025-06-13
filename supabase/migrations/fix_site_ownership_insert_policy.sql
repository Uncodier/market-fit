-- Fix site_ownership INSERT policy to allow site creation
-- This fixes the 403 error when creating new sites due to missing INSERT policy on site_ownership table

-- The site_ownership table has RLS enabled but only has a SELECT policy
-- When creating a site, the sync_site_ownership trigger tries to insert into site_ownership
-- but fails because there's no INSERT policy

-- Add INSERT policy for site_ownership table to allow the trigger to work
CREATE POLICY "Authenticated users can insert site ownership"
ON public.site_ownership
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow inserting ownership records for the authenticated user
  user_id = auth.uid()
);

-- Also add UPDATE and DELETE policies for completeness
CREATE POLICY "Users can update their own site ownership"
ON public.site_ownership
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own site ownership"
ON public.site_ownership
FOR DELETE
TO authenticated
USING (user_id = auth.uid()); 