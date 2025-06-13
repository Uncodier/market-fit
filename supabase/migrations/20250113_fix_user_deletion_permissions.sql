-- Fix user deletion permissions for site_members table
-- This allows Supabase to delete site_members records when a user is deleted

-- Add a policy to allow authenticated service role to delete site_members records during user deletion
CREATE POLICY "System can delete site members on user deletion"
ON public.site_members
FOR DELETE
TO service_role
USING (true);

-- Also add a policy to allow the authenticated service role to delete during cascade operations
CREATE POLICY "Service role can delete site members"
ON public.site_members
FOR DELETE
TO authenticated
USING (
  -- Allow deletion if the user being deleted is the same as the site member user_id
  -- This enables cascade deletion when auth.users records are deleted
  auth.uid() = user_id
  OR
  -- Keep existing permissions for regular users
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
);

-- Update the existing delete policy to be more specific about regular user deletions
DROP POLICY IF EXISTS "Delete site members" ON public.site_members;
CREATE POLICY "Delete site members"
ON public.site_members
FOR DELETE
USING (
  -- Site owners can delete members
  site_id IN (
    SELECT site_id FROM public.site_ownership WHERE user_id = auth.uid()
  )
); 