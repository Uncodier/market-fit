-- Fix: Set lead_analysis_summary view to SECURITY INVOKER
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

-- Postgres 15+: views can be marked as security invoker
ALTER VIEW public.lead_analysis_summary SET (security_invoker = true);

