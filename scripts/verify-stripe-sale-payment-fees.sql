-- Read-only installation diagnostic; plain PostgreSQL SQL (no psql commands).
-- Run only against an explicitly approved target. This never calls the money RPC.
-- PASS means the catalog/source contracts below match, not a runtime settlement
-- or historical-wallet reconciliation. A missing/old definition reports FAIL.
-- Requires catalog visibility; owner/superuser powers are outside browser ACLs.
BEGIN TRANSACTION READ ONLY;

WITH target AS (
  SELECT to_regprocedure(
    'public.apply_stripe_sale_financial_effects(uuid,text,numeric,text)'
  ) AS oid
), installed AS (
  SELECT p.*, l.lanname,
    pg_get_functiondef(p.oid) AS definition,
    regexp_replace(lower(p.prosrc), '[[:space:]]+', ' ', 'g') AS body,
    obj_description(p.oid, 'pg_proc') AS policy_comment
  FROM target t JOIN pg_proc p ON p.oid = t.oid
  JOIN pg_language l ON l.oid = p.prolang
), expected_rates(plan, rate) AS (
  VALUES ('enterprise', '0.045'), ('foundry', '0.055'),
         ('engine', '0.06'), ('commission', '0.07')
), checks AS (
  SELECT 'four_argument_function_installed' AS check_name,
    EXISTS (SELECT 1 FROM installed) AS passed
  UNION ALL
  SELECT 'jsonb_plpgsql_security_definer', EXISTS (
    SELECT 1 FROM installed WHERE prorettype = 'jsonb'::regtype
      AND lanname = 'plpgsql' AND prosecdef
  )
  UNION ALL
  SELECT 'pinned_search_path', EXISTS (
    SELECT 1 FROM installed WHERE proconfig @> ARRAY['search_path=public, pg_temp']
  )
  UNION ALL
  SELECT 'total_fee_case_' || e.plan || '_' || e.rate, EXISTS (
    SELECT 1 FROM installed i
    WHERE position('when v_plan = ''' || e.plan || ''' then ' || e.rate IN i.body) > 0
  ) FROM expected_rates e
  UNION ALL
  SELECT 'null_missing_unknown_fallback_7_percent', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE '%v_commission_rate := case%else 0.07 end;%'
      AND body NOT LIKE '%v_plan := coalesce(v_plan, ''foundry'')%'
  )
  UNION ALL
  SELECT 'missing_billing_explicit_commission_plan', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE
      '%insert into public.billing as current_billing (site_id, plan, account_balance) values (v_sale.site_id, ''commission'', v_balance_credit)%'
  )
  UNION ALL
  SELECT 'one_rounded_total_fee_no_extra_subtraction', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE
      '%v_commission_amount := round(p_settlement_amount * v_commission_rate, 2);%'
      AND body LIKE '%v_balance_credit := round(p_settlement_amount - v_commission_amount, 2);%'
      AND (SELECT count(*) FROM regexp_matches(body, 'v_balance_credit :=', 'g')) = 1
  )
  UNION ALL
  SELECT 'usd_finite_positive_cent_guards', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE
      '%upper(trim(coalesce(p_settlement_currency, ''''))) <> ''usd''%'
      AND body LIKE '%p_settlement_amount is null or p_settlement_amount <= 0%'
      AND body LIKE '%p_settlement_amount::text in (''nan'', ''infinity'', ''-infinity'')%'
      AND body LIKE '%p_settlement_amount <> round(p_settlement_amount, 2)%'
      AND body LIKE '%if v_balance_credit <= 0 then%'
  )
  UNION ALL
  SELECT 'eligible_sale_and_effect_bindings', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE '%v_effect.settlement_status <> ''settled''%'
      AND body LIKE '%v_effect.sale_id is distinct from p_sale_id%'
      AND body LIKE '%v_sale.stripe_checkout_session_id is distinct from p_session_id%'
      AND body LIKE '%coalesce(v_sale.amount_due, 0) <> 0%'
      AND body LIKE '%v_sale.status in (''cancelled'', ''refunded'')%'
  )
  UNION ALL
  SELECT 'effect_sale_billing_row_and_site_advisory_locks', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE '%from public.stripe_sale_checkout_effects%for update;%'
      AND body LIKE '%from public.sales%for update;%'
      AND body LIKE '%from public.billing%for update;%'
      AND body LIKE '%pg_advisory_xact_lock( hashtextextended(''stripe-billing:'' || v_sale.site_id::text, 0)%'
  )
  UNION ALL
  SELECT 'historical_exits_before_pricing_and_currency_recovery_guard', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE '%''status'', ''already_completed''%'
      AND body LIKE '%''status'', ''recovered_existing''%'
      AND position('''status'', ''already_completed''' IN body) < position('v_commission_rate := case' IN body)
      AND position('''status'', ''recovered_existing''' IN body) < position('v_commission_rate := case' IN body)
      AND body LIKE '%upper(currency) is distinct from ''usd'' or amount <> p_settlement_amount%'
  )
  UNION ALL
  SELECT 'ledger_rate_and_stable_transaction_identifiers', EXISTS (
    SELECT 1 FROM installed WHERE body LIKE '%v_suffix := coalesce(v_effect.order_id::text, p_session_id)%'
      AND body LIKE '%''sale_'' || p_sale_id::text || ''_'' || v_suffix%'
      AND body LIKE '%''commission_'' || p_sale_id::text || ''_'' || v_suffix%'
      AND (SELECT count(*) FROM regexp_matches(body, '''commission_rate'', v_commission_rate', 'g')) = 2
  )
  UNION ALL
  SELECT 'new_rows_mark_total_fee_processing_included', EXISTS (
    SELECT 1 FROM installed WHERE
      (SELECT count(*) FROM regexp_matches(body, '''commission_basis'', ''processing_included''', 'g')) = 2
  )
  UNION ALL
  SELECT 'service_role_execute', EXISTS (
    SELECT 1 FROM installed i JOIN pg_roles r ON r.rolname = 'service_role'
    WHERE has_function_privilege(r.oid, i.oid, 'EXECUTE')
  )
  UNION ALL
  SELECT 'no_browser_or_public_execute', EXISTS (SELECT 1 FROM installed)
    AND NOT EXISTS (
      SELECT 1 FROM installed i
      CROSS JOIN LATERAL aclexplode(coalesce(i.proacl, acldefault('f', i.proowner))) a
      LEFT JOIN pg_roles r ON r.oid = a.grantee
      WHERE a.privilege_type = 'EXECUTE'
        AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated'))
    ) AND NOT EXISTS (
      SELECT 1 FROM installed i JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated')
      WHERE has_function_privilege(r.oid, i.oid, 'EXECUTE')
    )
)
SELECT jsonb_build_object(
  'verification_status', CASE WHEN bool_and(passed) THEN 'PASS' ELSE 'FAIL' END,
  'diagnostic', CASE WHEN bool_and(passed) THEN 'Catalog/source contracts match; no settlement executed.'
    ELSE 'Missing, old, or incompatible installation. Review failed checks and the effective definition; apply nothing from this script.' END,
  'checks', jsonb_object_agg(check_name, passed ORDER BY check_name),
  'expected_total_fee_rates', (SELECT jsonb_object_agg(plan, rate::numeric) FROM expected_rates),
  'fallback_rate', 0.07,
  'effective_signature', (SELECT oid::regprocedure::text FROM installed),
  'function_owner', (SELECT pg_get_userbyid(proowner) FROM installed),
  'function_acl', (SELECT proacl::text FROM installed),
  'policy_comment', (SELECT policy_comment FROM installed),
  'effective_definition', (SELECT definition FROM installed),
  'all_overloads', (SELECT jsonb_agg(p.oid::regprocedure::text ORDER BY p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'apply_stripe_sale_financial_effects')
) AS stripe_sale_payment_fee_verification
FROM checks;

COMMIT;