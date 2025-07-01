-- FIX ALLOWED_DOMAINS RLS POLICY
-- Resolves: Error adding domain: new row violates row-level security policy
-- Removes all conflicting policies and creates a single optimized policy

-- ============================================================================
-- STEP 1: DROP ALL EXISTING CONFLICTING POLICIES
-- ============================================================================

-- Drop ALL possible existing policies for allowed_domains
DROP POLICY IF EXISTS "allowed_domains_optimized_policy" ON allowed_domains;
DROP POLICY IF EXISTS "allowed_domains_unified" ON allowed_domains;
DROP POLICY IF EXISTS "allowed_domains_optimized" ON allowed_domains;
DROP POLICY IF EXISTS "Users can manage allowed domains for their sites" ON allowed_domains;
DROP POLICY IF EXISTS "Users can view allowed domains for their sites" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can insert allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can update allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "Only owners and admins can delete allowed domains" ON allowed_domains;
DROP POLICY IF EXISTS "allowed_domains_final_policy" ON allowed_domains;
DROP POLICY IF EXISTS "allowed_domains_simple_policy" ON allowed_domains;

-- ============================================================================
-- STEP 2: CREATE SINGLE OPTIMIZED POLICY
-- ============================================================================

-- Create ONE policy that allows site owners and members to manage domains
CREATE POLICY "allowed_domains_access_policy" ON allowed_domains
FOR ALL
TO authenticated
USING (
  -- Users can access domains for sites they own or are active members of
  site_id IN (
    -- Site owners
    SELECT site_id FROM site_ownership WHERE user_id = (SELECT auth.uid())
    UNION
    -- Active site members
    SELECT site_id FROM site_members 
    WHERE user_id = (SELECT auth.uid()) AND status = 'active'
  )
)
WITH CHECK (
  -- Users can modify domains for sites they own or are active members of
  site_id IN (
    -- Site owners
    SELECT site_id FROM site_ownership WHERE user_id = (SELECT auth.uid())
    UNION
    -- Active site members
    SELECT site_id FROM site_members 
    WHERE user_id = (SELECT auth.uid()) AND status = 'active'
  )
);

-- ============================================================================
-- STEP 3: ENSURE RLS IS ENABLED AND GRANT PERMISSIONS
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE allowed_domains ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON allowed_domains TO authenticated;

-- ============================================================================
-- STEP 4: CREATE PERFORMANCE INDEX IF NOT EXISTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_allowed_domains_site_id ON allowed_domains(site_id);

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Show final policy state
SELECT 'ALLOWED_DOMAINS RLS FIXED: Single policy created!' as status;

-- Verify the policy exists
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'allowed_domains' AND schemaname = 'public'
ORDER BY policyname; 