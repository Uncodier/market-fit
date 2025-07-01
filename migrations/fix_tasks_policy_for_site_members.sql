-- Fix tasks policy to allow site members access
-- The current policy only allows access to the task creator (user_id = auth.uid())
-- This migration fixes it to also allow site members access, like other tables

DO $$
BEGIN
    RAISE NOTICE '🔧 Fixing tasks policy to allow site members access...';
    
    -- Drop the current incorrect policy
    DROP POLICY IF EXISTS "tasks_unified" ON tasks;
    
    -- Create the correct policy that includes site members
    CREATE POLICY "tasks_unified" ON tasks FOR ALL USING (
      EXISTS (
        SELECT 1 FROM sites s WHERE s.id = tasks.site_id AND (
          s.user_id = (select auth.uid()) OR
          EXISTS (SELECT 1 FROM site_members sm WHERE sm.site_id = s.id AND sm.user_id = (select auth.uid()))
        )
      )
    );
    
    RAISE NOTICE '✅ Tasks policy fixed - site members now have access';
    
END $$;

-- Verify the fix
DO $$
DECLARE
    policy_found BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Verifying tasks policy...';
    
    -- Check if the policy exists and has the correct structure
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'tasks' 
        AND policyname = 'tasks_unified'
        AND qual LIKE '%site_members%'
    ) INTO policy_found;
    
    IF policy_found THEN
        RAISE NOTICE '✅ Tasks policy verification successful';
        RAISE NOTICE '✅ Site members should now be able to see tasks';
    ELSE
        RAISE NOTICE '❌ Tasks policy verification failed';
        RAISE NOTICE '❌ Manual review required';
    END IF;
    
END $$;

SELECT 'TASKS_POLICY_FIXED_FOR_SITE_MEMBERS' AS status; 