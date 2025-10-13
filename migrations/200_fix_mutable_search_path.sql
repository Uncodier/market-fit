-- Secure function search_path hardening
-- Lint: 0011_function_search_path_mutable
-- Purpose: Ensure SECURITY DEFINER functions have fixed, empty search_path to prevent hijacking
-- Notes:
--  - We use CREATE OR REPLACE with SET search_path = '' and fully qualify any referenced objects
--  - We preserve existing volatility and security attributes
--  - We no-op if target function does not exist (guards included where needed)

DO $$
BEGIN
  -- 1) auth.is_service_role_or_user_condition(boolean)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
      AND p.proname = 'is_service_role_or_user_condition'
      AND pg_get_function_identity_arguments(p.oid) = 'user_condition boolean'
  ) THEN
    -- Recreate with fixed search_path; keep logic identical to current consolidated migration
    CREATE OR REPLACE FUNCTION auth.is_service_role_or_user_condition(user_condition boolean)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
    AS $isr$
      SELECT COALESCE(
        (SELECT current_setting('role')) = 'service_role',
        ((SELECT current_setting('role')) = 'authenticated' AND ((SELECT auth.jwt()) ->> 'role') = 'service_role'),
        user_condition,
        false
      );
    $isr$;
  END IF;
END $$;

-- 2) public.set_updated_at() trigger helper
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $upd$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $upd$;
  END IF;
END $$;

-- 3) app_auth.validate_metadata_size(...) if present
DO $$
DECLARE
  fn_oid oid;
BEGIN
  SELECT p.oid INTO fn_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'app_auth'
    AND p.proname = 'validate_metadata_size'
  LIMIT 1;

  IF fn_oid IS NOT NULL THEN
    -- Recreate function body with fixed search_path.
    -- NOTE: We cannot infer original arguments/return type here reliably.
    -- For safety, use ALTER FUNCTION to set a fixed search_path instead of redefining.
    EXECUTE format(
      'ALTER FUNCTION app_auth.validate_metadata_size(%s) SET search_path = %L;',
      pg_get_function_identity_arguments(fn_oid),
      ''
    );
  END IF;
END $$;


-- 4) app_auth.is_service_role_or_user_condition(...) if present (any signatures)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_auth'
      AND p.proname = 'is_service_role_or_user_condition'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION app_auth.is_service_role_or_user_condition(%s) SET search_path = %L;',
      rec.args,
      ''
    );
  END LOOP;
END $$;

-- 5) Consolidate policies for public.role_query_segments to a single permissive policy per action (FOR ALL)
DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Drop all existing policies to avoid duplicates/multiple permissive policies
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'role_query_segments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.role_query_segments', pol.policyname);
  END LOOP;

  -- Create a unified policy for authenticated users, covering all actions
  CREATE POLICY "role_query_segments_unified" ON public.role_query_segments
  FOR ALL
  TO authenticated
  USING (
    auth.is_service_role_or_user_condition(
      EXISTS (
        SELECT 1
        FROM public.segments s
        JOIN public.site_members sm ON sm.site_id = s.site_id
        WHERE s.id = role_query_segments.segment_id
          AND sm.user_id = (SELECT auth.uid())
          AND sm.status = 'active'
      )
    )
  )
  WITH CHECK (
    auth.is_service_role_or_user_condition(
      EXISTS (
        SELECT 1
        FROM public.segments s
        JOIN public.site_members sm ON sm.site_id = s.site_id
        WHERE s.id = role_query_segments.segment_id
          AND sm.user_id = (SELECT auth.uid())
          AND sm.status = 'active'
      )
    )
  );
END $$;

