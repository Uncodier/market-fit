-- DIAGNOSE: Why site members can't see sites
-- Execute this in Supabase Dashboard → SQL Editor

-- Check current policies on sites table
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

-- Check if we have records in site_ownership for invited member
SELECT 
  'site_ownership' as table_name,
  COUNT(*) as record_count,
  string_agg(DISTINCT user_id::text, ', ') as user_ids
FROM site_ownership;

-- Check if we have records in site_members for invited member  
SELECT 
  'site_members' as table_name,
  COUNT(*) as record_count,
  string_agg(DISTINCT user_id::text, ', ') as user_ids,
  string_agg(DISTINCT status, ', ') as statuses
FROM site_members; 