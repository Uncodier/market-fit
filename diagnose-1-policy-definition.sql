-- Script 1: Ver definición actual de la política visitors_unified
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as policy_definition
FROM pg_policies 
WHERE tablename = 'visitors' 
AND schemaname = 'public' 
AND policyname = 'visitors_unified'; 