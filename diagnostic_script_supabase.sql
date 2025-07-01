-- DIAGNOSTIC SCRIPT: Infinite Recursion in site_members
-- Copy and paste this in Supabase Dashboard → SQL Editor

-- 1. Check current RLS policies on site_members
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'site_members'
ORDER BY policyname;

-- 2. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'site_members';

-- 3. Check current policies on sites table (might be causing cross-reference issues)
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'sites'
ORDER BY policyname;

-- 4. Check site_ownership table exists and its policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'site_ownership'
ORDER BY policyname; 