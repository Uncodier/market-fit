-- Clean duplicate tasks policies
-- We have both "tasks_optimized_policy" and "tasks_unified" causing performance warnings
-- Keep only "tasks_unified" which has the correct logic for site members

DO $$
BEGIN
    RAISE NOTICE '🧹 Cleaning duplicate tasks policies...';
    
    -- Drop the old optimized policy that doesn't include site members
    DROP POLICY IF EXISTS "tasks_optimized_policy" ON tasks;
    
    -- Verify we still have the correct unified policy
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'tasks' 
        AND policyname = 'tasks_unified'
    ) THEN
        RAISE NOTICE '✅ Kept "tasks_unified" policy (includes site members)';
        RAISE NOTICE '✅ Removed "tasks_optimized_policy" (duplicate)';
    ELSE
        RAISE NOTICE '❌ Warning: tasks_unified policy not found!';
    END IF;
    
END $$;

-- Verify final state
DO $$
DECLARE
    policy_count INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Verifying final tasks policies...';
    
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'tasks';
    
    RAISE NOTICE 'Total tasks policies: %', policy_count;
    
    -- List remaining policies
    FOR rec IN
        SELECT policyname, cmd 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'tasks'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '  • % (%)', rec.policyname, rec.cmd;
    END LOOP;
    
    IF policy_count = 1 THEN
        RAISE NOTICE '✅ Perfect! Only one policy remains';
        RAISE NOTICE '✅ Multiple permissive policies warnings should be gone';
    ELSE
        RAISE NOTICE '⚠️  Expected 1 policy, found %', policy_count;
    END IF;
    
END $$;

SELECT 'DUPLICATE_TASKS_POLICIES_CLEANED' AS status; 