-- Fix: Set immutable search_path for trigger functions flagged by linter
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Ensure functions use a fixed search_path
ALTER FUNCTION public.update_lead_analysis_updated_at() SET search_path = public;
ALTER FUNCTION public.update_copywriting_updated_at() SET search_path = public;


