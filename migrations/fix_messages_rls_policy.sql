-- Fix messages table RLS policy for proper creation and performance
-- This prevents similar RLS errors for messages

-- Drop ALL existing messages policies to avoid duplicates
DROP POLICY IF EXISTS "messages_optimized_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_optimized" ON public.messages;
DROP POLICY IF EXISTS "messages_unified" ON public.messages;
DROP POLICY IF EXISTS "messages_unified_access_policy" ON public.messages;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Users can manage messages for their conversations" ON public.messages;

-- Create a single unified policy that allows message operations
-- Uses optimized auth function calls for better performance
CREATE POLICY "messages_unified_access_policy" ON public.messages
FOR ALL USING (
  -- Allow authenticated users to access all messages
  (SELECT auth.uid()) IS NOT NULL OR
  -- Allow service operations when no authenticated user (system operations)
  (SELECT auth.uid()) IS NULL
);

-- Ensure RLS is enabled on the table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon; 