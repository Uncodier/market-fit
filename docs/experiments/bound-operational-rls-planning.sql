-- EXPERIMENT ONLY: REJECTED FOR ROLLOUT. NOT FOR PRODUCTION / NOT APPLIED.
-- Kept outside supabase/migrations because the isolated executor measurements
-- regress despite reduced planner allocation. Re-review before any future use.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Deparse with no application schema in the path: parent relations/functions
-- must remain schema-qualified even if a caller creates similarly named objects.
SET LOCAL search_path = pg_catalog;

-- Keep the existing restrictive expressions and caller-visible parent checks.
-- A non-inlineable invoker function bounds planner expansion; it does NOT read
-- parents as the owner, turn off RLS, or replace membership/buyer/action policies.
CREATE SCHEMA IF NOT EXISTS operational_rls_private;
DO $ownership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace
    WHERE nspname = 'operational_rls_private' AND nspowner = current_user::regrole) THEN
    RAISE EXCEPTION 'Untrusted owner of operational_rls_private';
  END IF;
END;
$ownership$;
REVOKE ALL ON SCHEMA operational_rls_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA operational_rls_private TO authenticated;

CREATE TABLE IF NOT EXISTS operational_rls_private.policy_originals (
  table_name text PRIMARY KEY,
  relation_oid oid NOT NULL,
  policy_oid oid NOT NULL,
  original_using text NOT NULL,
  original_check text NOT NULL,
  original_roles oid[] NOT NULL,
  original_command "char" NOT NULL,
  original_permissive boolean NOT NULL,
  bounded_expression text NOT NULL,
  function_oid oid NOT NULL,
  function_body text NOT NULL,
  dependencies jsonb NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $ownership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class
    WHERE oid = 'operational_rls_private.policy_originals'::regclass
      AND relowner = current_user::regrole AND relkind = 'r') THEN
    RAISE EXCEPTION 'Untrusted operational policy backup relation';
  END IF;
  -- Table-level REVOKE does not remove pre-existing column-level grants. A
  -- replay must not turn a caller-readable counterfeit relation into the audit
  -- store or preserve an INSERT/UPDATE column grant over original expressions.
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) actor
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
    WHERE has_any_column_privilege(actor, 'operational_rls_private.policy_originals', privilege)) THEN
    RAISE EXCEPTION 'Untrusted operational policy backup access';
  END IF;
END;
$ownership$;
ALTER TABLE operational_rls_private.policy_originals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE operational_rls_private.policy_originals FROM PUBLIC, anon, authenticated, service_role;
DO $backup_acl$
BEGIN
  -- Table-level REVOKE does not clear column-level or inherited privileges.
  -- A pre-existing backup must not become an application-readable data source.
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) actor
    WHERE has_any_column_privilege(actor, 'operational_rls_private.policy_originals',
      'SELECT,INSERT,UPDATE,REFERENCES'))
    OR EXISTS (SELECT 1 FROM pg_policy
      WHERE polrelid = 'operational_rls_private.policy_originals'::regclass)
    OR EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'operational_rls_private.policy_originals'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Untrusted operational policy backup access or hooks';
  END IF;
END;
$backup_acl$;

DO $migration$
DECLARE
  target text;
  relation oid;
  policy record;
  saved record;
  column_info record;
  parameters text;
  projection text;
  arguments text;
  signature text;
  function_name text;
  body text;
  bounded text;
  ordinal integer;
  allowed_columns text[];
  function_id oid;
  original_dependencies jsonb;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'conversations', 'tasks', 'reservations', 'sale_order_item_units',
    'messages', 'task_comments', 'task_categories', 'shipment_location_pings',
    'inventory_levels', 'transactions', 'pos_register_receipts'
  ] LOOP
    relation := to_regclass(format('public.%I', target));
    IF relation IS NULL OR NOT EXISTS (SELECT 1 FROM pg_class
      WHERE oid = relation AND relkind IN ('r','p') AND relrowsecurity) THEN
      RAISE EXCEPTION 'Missing operational ACL table public.%', target;
    END IF;
    -- Serialize policy inspection with replacement. No data backfill or rewrite.
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', target);
    SELECT p.*, pg_get_expr(p.polqual, p.polrelid) AS using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
      INTO policy FROM pg_policy p
      WHERE p.polrelid = relation AND p.polname = 'location_acl_enforcement';
    IF NOT FOUND OR policy.polpermissive OR policy.polcmd <> '*'
      OR policy.polroles <> ARRAY['authenticated'::regrole::oid]
      OR policy.using_expression IS NULL OR policy.check_expression IS NULL THEN
      RAISE EXCEPTION 'Unexpected restrictive operational ACL on public.%', target;
    END IF;
    SELECT * INTO saved FROM operational_rls_private.policy_originals WHERE table_name = target;
    IF FOUND THEN
      -- PL/pgSQL statements are resolved lazily. Do not accept replay after a
      -- parent object has been renamed/replaced under the old textual name.
      -- Original RLS subqueries followed object OIDs; preserve that identity in
      -- the rollout gate even though the bounded bodies are not dependency edges.
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(saved.dependencies) dependency
        WHERE (SELECT identity FROM pg_identify_object(
          (dependency->>'class')::oid, (dependency->>'object')::oid,
          (dependency->>'column')::integer)) IS DISTINCT FROM dependency->>'identity')
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(saved.dependencies) dependency
          WHERE (dependency->>'class')::oid = 'pg_proc'::regclass
            AND NOT has_function_privilege('authenticated', (dependency->>'object')::oid, 'EXECUTE'))
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(saved.dependencies) dependency
          JOIN pg_class parent ON parent.oid = (dependency->>'object')::oid
          WHERE (dependency->>'class')::oid = 'pg_class'::regclass
            AND parent.oid <> relation AND parent.relkind IN ('r','p','v','m')
            AND (dependency->>'column')::integer > 0
            AND NOT has_column_privilege('authenticated', parent.oid,
              (dependency->>'column')::smallint, 'SELECT')) THEN
        RAISE EXCEPTION 'Operational ACL dependency changed after optimization on public.%', target;
      END IF;
      IF policy.using_expression IS DISTINCT FROM saved.bounded_expression
        OR policy.check_expression IS DISTINCT FROM saved.bounded_expression
        OR relation <> saved.relation_oid OR policy.oid <> saved.policy_oid
        OR NOT EXISTS (SELECT 1 FROM pg_proc f WHERE f.oid = saved.function_oid
          AND NOT f.prosecdef AND f.provolatile = 's' AND NOT f.proisstrict
          AND NOT f.proleakproof AND f.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
          AND f.proowner = current_user::regrole
          AND f.prosrc = saved.function_body
          AND f.proconfig = ARRAY['search_path=pg_catalog']
          AND NOT has_function_privilege('anon', f.oid, 'EXECUTE')
          AND NOT has_function_privilege('service_role', f.oid, 'EXECUTE')
          AND has_function_privilege('authenticated', f.oid, 'EXECUTE')) THEN
        RAISE EXCEPTION 'Operational ACL changed after optimization on public.%', target;
      END IF;
      CONTINUE;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('class', d.refclassid,
      'object', d.refobjid, 'column', d.refobjsubid,
      'identity', (SELECT identity FROM pg_identify_object(d.refclassid, d.refobjid, d.refobjsubid)))), '[]'::jsonb)
      INTO original_dependencies FROM pg_depend d
      WHERE d.classid = 'pg_policy'::regclass AND d.objid = policy.oid;
    -- Wrappers check parent permissions when their body executes, whereas the
    -- original subquery checks them during statement startup. Require the same
    -- effective parent-column/function privileges before changing that timing.
    IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_class parent ON parent.oid = d.refobjid
      WHERE d.classid = 'pg_policy'::regclass AND d.objid = policy.oid
        AND d.refclassid = 'pg_class'::regclass AND d.refobjid <> relation
        AND parent.relkind IN ('r','p','v','m') AND d.refobjsubid > 0
        AND NOT has_column_privilege('authenticated', parent.oid, d.refobjsubid::smallint, 'SELECT'))
      OR EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_policy'::regclass
        AND d.objid = policy.oid AND d.refclassid = 'pg_proc'::regclass
        AND NOT has_function_privilege('authenticated', d.refobjid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'Missing authenticated parent privileges on operational ACL public.%', target;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_proc f ON f.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = f.pronamespace
      WHERE d.classid = 'pg_policy'::regclass AND d.objid = policy.oid
        AND d.refclassid = 'pg_proc'::regclass AND
        (n.nspname <> 'public' OR f.oid NOT IN
          ('public.current_user_has_location_restrictions()'::regprocedure,
           'public.current_user_site_role(uuid)'::regprocedure,
           'public.user_can_access_location(uuid,uuid)'::regprocedure)
          OR f.provolatile <> 's')) THEN
      RAISE EXCEPTION 'Unreviewed operational ACL function on public.%', target;
    END IF;
    -- This rollout only supports the reviewed symmetric ALL contract. Never
    -- silently substitute USING for a different INSERT/UPDATE WITH CHECK.
    IF policy.using_expression IS DISTINCT FROM policy.check_expression THEN
      RAISE EXCEPTION 'Asymmetric operational ACL requires review on public.%', target;
    END IF;
    allowed_columns := CASE target
      WHEN 'tasks' THEN ARRAY['site_id','location_id','conversation_id','deal_id','lead_id']
      WHEN 'reservations' THEN ARRAY['site_id','operating_location_id','sale_order_item_id']
      WHEN 'sale_order_item_units' THEN ARRAY['site_id','sale_order_item_id','shipment_id']
      WHEN 'conversations' THEN ARRAY['site_id','location_id']
      WHEN 'messages' THEN ARRAY['conversation_id']
      WHEN 'task_comments' THEN ARRAY['task_id']
      WHEN 'task_categories' THEN ARRAY['task_id']
      WHEN 'shipment_location_pings' THEN ARRAY['site_id','shipment_id']
      WHEN 'inventory_levels' THEN ARRAY['site_id','location_id','catalog_item_id']
      WHEN 'transactions' THEN ARRAY['site_id','location_id','sale_order_id']
      WHEN 'pos_register_receipts' THEN ARRAY['site_id','session_id','sale_id']
    END;
    IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_attribute a
        ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      WHERE d.classid = 'pg_policy'::regclass AND d.objid = policy.oid
        AND d.refclassid = 'pg_class'::regclass AND d.refobjid = relation
        AND (d.refobjsubid < 0 OR (d.refobjsubid > 0 AND
          (NOT a.attname = ANY(allowed_columns) OR a.atttypid <> 'uuid'::regtype))))
      OR policy.using_expression !~ 'public\.current_user_has_location_restrictions\(\)'
      OR (target NOT IN ('messages','task_comments','task_categories')
        AND policy.using_expression !~ 'public\.current_user_site_role\(')
      OR left(policy.using_expression,
        length('((NOT ( SELECT public.current_user_has_location_restrictions() AS current_user_has_location_restrictions)) OR ')) <>
        '((NOT ( SELECT public.current_user_has_location_restrictions() AS current_user_has_location_restrictions)) OR '
      OR (length(policy.using_expression) - length(replace(policy.using_expression,
          'public.current_user_has_location_restrictions()', ''))) /
          length('public.current_user_has_location_restrictions()') <> 1
      OR policy.using_expression ~ '\.\*|ctid|tableoid' THEN
      RAISE EXCEPTION 'Unreviewed operational ACL dependencies on public.%', target;
    END IF;
    -- A non-invoker view checked as a non-bypass owner has different parent
    -- identity semantics. Refuse that rollout rather than changing its access.
    IF EXISTS (WITH RECURSIVE dependent_views(oid) AS (
        SELECT relation UNION
        SELECT w.ev_class FROM dependent_views parent JOIN pg_depend d
          ON d.refclassid = 'pg_class'::regclass AND d.refobjid = parent.oid
        JOIN pg_rewrite w ON d.classid = 'pg_rewrite'::regclass AND d.objid = w.oid
        WHERE w.ev_class <> parent.oid
      ) SELECT 1 FROM dependent_views dependencies
      JOIN pg_class v ON v.oid = dependencies.oid JOIN pg_roles r ON r.oid = v.relowner
      WHERE v.relkind IN ('v','m') AND NOT r.rolsuper AND NOT r.rolbypassrls
        AND NOT coalesce(v.reloptions, '{}'::text[]) @> ARRAY['security_invoker=true']) THEN
      RAISE EXCEPTION 'Review owner-context operational view before optimizing public.%', target;
    END IF;
    parameters := 'p_restricted boolean'; projection := '';
    arguments := '(SELECT public.current_user_has_location_restrictions())';
    signature := 'boolean'; ordinal := 0;
    -- Preserve precisely the original row-column dependencies, not a whole-row
    -- argument (which could require new privileges or read unrelated columns).
    FOR column_info IN
      SELECT DISTINCT a.attnum, a.attname, format_type(a.atttypid, a.atttypmod) AS sql_type
      FROM pg_depend d JOIN pg_attribute a
        ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      WHERE d.classid = 'pg_policy'::regclass AND d.objid = policy.oid
        AND d.refclassid = 'pg_class'::regclass AND d.refobjid = relation
        AND d.refobjsubid > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    LOOP
      ordinal := ordinal + 1;
      IF ordinal > 1 THEN
        projection := projection || ', ';
      END IF;
      parameters := parameters || format(', p_%s %s', ordinal, column_info.sql_type);
      projection := projection || format('p_%s AS %I', ordinal, column_info.attname);
      arguments := arguments || format(', %I.%I', target, column_info.attname);
      signature := signature || ', ' || column_info.sql_type;
    END LOOP;
    IF ordinal = 0 THEN
      RAISE EXCEPTION 'Operational ACL has no row dependencies on public.%', target;
    END IF;
    function_name := target || '_location_check';
    -- Preserve the original statement-level InitPlan. Recomputing this global
    -- membership predicate for every row would turn planner savings into an
    -- executor regression. No actor/cache state is stored in a caller-set GUC.
    body := format('BEGIN
      IF p_restricted IS FALSE THEN RETURN true; END IF;
      RETURN (SELECT (%s) FROM (SELECT %s) AS %I);
      END;',
      replace(policy.using_expression,
        'public.current_user_has_location_restrictions()', 'p_restricted'), projection, target);
    EXECUTE format('CREATE FUNCTION operational_rls_private.%I(%s) RETURNS boolean
      LANGUAGE plpgsql STABLE SECURITY INVOKER
      SET search_path = pg_catalog AS %L', function_name, parameters, body);
    EXECUTE format('REVOKE ALL ON FUNCTION operational_rls_private.%I(%s)
      FROM PUBLIC, anon, authenticated, service_role', function_name, signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION operational_rls_private.%I(%s)
      TO authenticated', function_name, signature);
    EXECUTE format('COMMENT ON FUNCTION operational_rls_private.%I(%s) IS %L',
      function_name, signature,
      'Bounded planner expression; executes the original location ACL with caller RLS and identity.');
    bounded := format('operational_rls_private.%I(%s)', function_name, arguments);
    EXECUTE format('ALTER POLICY location_acl_enforcement ON public.%I
      USING (%s) WITH CHECK (%s)', target, bounded, bounded);
    -- Store the catalog-normalized expression so replay detects drift reliably.
    SELECT pg_get_expr(polqual, polrelid) INTO bounded FROM pg_policy
      WHERE polrelid = relation AND polname = 'location_acl_enforcement';
    function_id := to_regprocedure(format('operational_rls_private.%I(%s)', function_name, signature));
    INSERT INTO operational_rls_private.policy_originals
      (table_name, relation_oid, policy_oid, original_using, original_check,
        original_roles, original_command, original_permissive,
        bounded_expression, function_oid, function_body, dependencies)
      VALUES (target, relation, policy.oid, policy.using_expression, policy.check_expression,
        policy.polroles, policy.polcmd, policy.polpermissive,
        bounded, function_id, body, original_dependencies);
  END LOOP;
END;
$migration$;

COMMIT;