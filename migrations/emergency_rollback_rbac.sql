-- EMERGENCY ROLLBACK: Remove RBAC causing infinite recursion
-- This script removes all RBAC functions and policies and restores simple working policies

-- Step 1: First drop all RBAC policies that depend on the functions
-- Drop leads RBAC policies
DROP POLICY IF EXISTS leads_rbac_select ON leads;
DROP POLICY IF EXISTS leads_rbac_insert ON leads;
DROP POLICY IF EXISTS leads_rbac_update ON leads;
DROP POLICY IF EXISTS leads_rbac_delete ON leads;

-- Drop campaigns RBAC policies  
DROP POLICY IF EXISTS campaigns_rbac_select ON campaigns;
DROP POLICY IF EXISTS campaigns_rbac_insert ON campaigns;
DROP POLICY IF EXISTS campaigns_rbac_update ON campaigns;
DROP POLICY IF EXISTS campaigns_rbac_delete ON campaigns;

-- Drop experiments RBAC policies
DROP POLICY IF EXISTS experiments_rbac_select ON experiments;
DROP POLICY IF EXISTS experiments_rbac_insert ON experiments;
DROP POLICY IF EXISTS experiments_rbac_update ON experiments;
DROP POLICY IF EXISTS experiments_rbac_delete ON experiments;

-- Drop segments RBAC policies
DROP POLICY IF EXISTS segments_rbac_select ON segments;
DROP POLICY IF EXISTS segments_rbac_insert ON segments;
DROP POLICY IF EXISTS segments_rbac_update ON segments;
DROP POLICY IF EXISTS segments_rbac_delete ON segments;

-- Step 2: Now drop the RBAC functions that were causing recursion
DROP FUNCTION IF EXISTS user_can_perform_action(uuid, text, uuid);
DROP FUNCTION IF EXISTS get_user_role_for_site(uuid, uuid);

-- Step 3: Remove any other recursive policies causing infinite loops
DROP POLICY IF EXISTS site_members_optimized_policy ON site_members;

-- Step 4: Recreate simple working policies for site_members
CREATE POLICY "site_members_simple_policy" ON site_members
FOR ALL
TO authenticated
USING (
  -- Allow if user is the owner or member
  user_id = auth.uid() OR
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Allow if user is the owner
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
  )
);

-- Step 5: Recreate simple policies for leads (without role checking)
CREATE POLICY "leads_simple_policy" ON leads
FOR ALL
TO authenticated
USING (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
);

-- Step 6: Recreate simple policies for campaigns (without role checking)
CREATE POLICY "campaigns_simple_policy" ON campaigns
FOR ALL
TO authenticated
USING (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
);

-- Step 7: Recreate simple policies for experiments (without role checking)
CREATE POLICY "experiments_simple_policy" ON experiments
FOR ALL
TO authenticated
USING (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
);

-- Step 8: Recreate simple policies for segments (without role checking)
CREATE POLICY "segments_simple_policy" ON segments
FOR ALL
TO authenticated
USING (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  site_id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
);

-- Step 9: Update sites policies to check both ownership and membership
DROP POLICY IF EXISTS sites_optimized_policy ON sites;

CREATE POLICY "sites_simple_policy" ON sites
FOR ALL
TO authenticated
USING (
  -- Allow if user is owner or member
  id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
    UNION
    SELECT site_id FROM site_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Only owners can modify sites
  id IN (
    SELECT site_id FROM site_ownership WHERE user_id = auth.uid()
  )
);

-- Verification queries to check current state
-- (These will show what policies exist after the rollback)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('site_members', 'sites', 'leads', 'campaigns', 'experiments', 'segments')
ORDER BY tablename, policyname; 