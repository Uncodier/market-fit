-- Fix sales table RLS policy for proper creation and performance
-- This addresses the "new row violates row-level security policy for table sales" error

-- Drop ALL existing sales policies to avoid duplicates
DROP POLICY IF EXISTS "sales_optimized_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_unified" ON public.sales;
DROP POLICY IF EXISTS "sales_unified_access_policy" ON public.sales;
DROP POLICY IF EXISTS "Users can view sales for their sites" ON public.sales;
DROP POLICY IF EXISTS "Users can create sales for their sites" ON public.sales;
DROP POLICY IF EXISTS "Users can update sales for their sites" ON public.sales;
DROP POLICY IF EXISTS "Users can delete sales for their sites" ON public.sales;
DROP POLICY IF EXISTS "Users can manage sales for their sites" ON public.sales;

-- Create a single unified policy that allows sales operations for site owners/members
-- Uses optimized auth function calls for better performance
CREATE POLICY "sales_unified_access_policy" ON public.sales
FOR ALL USING (
  -- Allow users to access sales from sites they own or are members of
  EXISTS (
    SELECT 1 FROM public.sites s 
    WHERE s.id = sales.site_id AND (
      -- Site owner
      s.user_id = (SELECT auth.uid()) OR
      -- Site member
      EXISTS (
        SELECT 1 FROM public.site_members sm 
        WHERE sm.site_id = s.id AND sm.user_id = (SELECT auth.uid())
      )
    )
  ) OR
  -- Allow service operations when no authenticated user (system operations)
  (SELECT auth.uid()) IS NULL
);

-- Ensure RLS is enabled on the table
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO anon; 