-- Grant appropriate access to the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.instance_artifacts TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view instance artifacts" ON public.instance_artifacts;
DROP POLICY IF EXISTS "Users can delete instance artifacts" ON public.instance_artifacts;
DROP POLICY IF EXISTS "instance_artifacts service only" ON public.instance_artifacts;

-- Create comprehensive SELECT policy for site members
CREATE POLICY "Users can view instance artifacts"
  ON public.instance_artifacts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = user_id) 
    OR (instance_id IN ( SELECT remote_instances.id FROM remote_instances WHERE remote_instances.user_id = auth.uid() )) 
    OR (site_id IN ( SELECT sites.id FROM sites WHERE sites.user_id = auth.uid() ))
    OR EXISTS (
      SELECT 1 FROM public.site_members
      WHERE site_members.site_id = instance_artifacts.site_id
        AND site_members.user_id = auth.uid()
        AND site_members.status = 'active'
    )
  );

-- Create comprehensive DELETE policy for site members
CREATE POLICY "Users can delete instance artifacts"
  ON public.instance_artifacts
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id) 
    OR ((site_id IS NOT NULL) AND user_can(site_id, 'delete'::text)) 
    OR ((instance_id IS NOT NULL) AND (instance_id IN ( SELECT remote_instances.id FROM remote_instances WHERE remote_instances.user_id = auth.uid() )))
    OR EXISTS (
      SELECT 1 FROM public.site_members
      WHERE site_members.site_id = instance_artifacts.site_id
        AND site_members.user_id = auth.uid()
        AND site_members.status = 'active'
    )
  );
