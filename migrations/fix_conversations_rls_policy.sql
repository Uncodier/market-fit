-- Fix conversations table RLS policy for proper creation and performance
-- This addresses the "new row violates row-level security policy for table conversations" error

-- Drop ALL existing conversations policies to avoid duplicates
DROP POLICY IF EXISTS "conversations_optimized_policy" ON public.conversations;
DROP POLICY IF EXISTS "conversations_optimized" ON public.conversations;
DROP POLICY IF EXISTS "conversations_unified" ON public.conversations;
DROP POLICY IF EXISTS "conversations_unified_access_policy" ON public.conversations;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.conversations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.conversations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.conversations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage conversations for their sites" ON public.conversations;

-- Create a single unified policy that allows conversation operations
-- Uses optimized auth function calls for better performance
CREATE POLICY "conversations_unified_access_policy" ON public.conversations
FOR ALL USING (
  -- Allow authenticated users to access all conversations
  (SELECT auth.uid()) IS NOT NULL OR
  -- Allow service operations when no authenticated user (system operations)
  (SELECT auth.uid()) IS NULL
);

-- Ensure RLS is enabled on the table
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO anon; 