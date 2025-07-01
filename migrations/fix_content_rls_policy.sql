-- Fix content table RLS policy for proper creation
-- This addresses the "new row violates row-level security policy for table content" error

-- Drop ALL existing content policies to avoid duplicates
DROP POLICY IF EXISTS "content_optimized_policy" ON public.content;
DROP POLICY IF EXISTS "content_optimized" ON public.content;
DROP POLICY IF EXISTS "content_unified" ON public.content;
DROP POLICY IF EXISTS "content_comprehensive_policy" ON public.content;
DROP POLICY IF EXISTS "content_unified_access_policy" ON public.content;
DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.content;
DROP POLICY IF EXISTS "Filter by site_id only" ON public.content;
DROP POLICY IF EXISTS "Users can manage content for their sites" ON public.content;

-- Create a single unified policy that allows content operations for site owners/members
CREATE POLICY "content_unified_access_policy" ON public.content
FOR ALL USING (
  -- Allow users to access content from sites they own or are members of
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = content.site_id AND (
      -- Site owner
      s.user_id = (SELECT auth.uid()) OR
      -- Site member  
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
      )
    )
  )
  -- OR allow users to manage their own content regardless of site membership
  OR content.user_id = (SELECT auth.uid())
  OR content.author_id = (SELECT auth.uid())
);

-- Ensure RLS is enabled on the content table
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions for content operations
GRANT ALL ON public.content TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 