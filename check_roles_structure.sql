-- CHECK ROLES STRUCTURE
-- Execute this in Supabase Dashboard → SQL Editor

-- Check site_members table structure and current roles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'site_members'
ORDER BY ordinal_position;

-- Check actual role values in site_members
SELECT 
  role,
  COUNT(*) as count,
  string_agg(DISTINCT user_id::text, ', ') as user_ids
FROM site_members 
GROUP BY role;

-- Check current site_members policies
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