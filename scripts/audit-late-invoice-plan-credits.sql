-- Operator-only psql audit; no grant, role switch, provider calls, or schema changes.
-- Requires separately verified site_id and invoice_id psql variables. Do not use a site name.
\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL TIME ZONE 'UTC';
SET LOCAL statement_timeout = '10s';

WITH input AS (
  SELECT :'site_id'::uuid AS site_id, :'invoice_id'::text AS invoice_id
), evidence AS (
  SELECT a.*, b.plan AS billing_plan, b.subscription_status, b.plan_credit_source,
    b.plan_credit_period_start, b.plan_credit_period_end, b.plan_credit_allowance,
    b.plan_credits_used, b.plan_credits_available, b.monthly_credits_used,
    b.purchased_credits_available, b.legacy_credits_available,
    b.trial_credits_available, b.account_balance, b.credits_available,
    s.credit_coverage_applied, s.credits_granted,
    public.site_plan_credit_allowance(a.plan,(s.verified_credit_coverage->>'addons_count')::integer) AS invoice_allowance,
    EXISTS (SELECT 1 FROM public.stripe_late_renewal_reversals r WHERE r.charge_id=a.charge_id) AS reversed,
    NOT EXISTS (SELECT 1 FROM public.site_retired_stripe_subscriptions r
      WHERE r.site_id=a.site_id AND r.subscription_id=a.subscription_id) AS not_retired,
    (b.stripe_customer_id=a.customer_id AND b.stripe_subscription_id=a.subscription_id
      AND b.subscription_end_date=a.ended_at AND b.subscription_status='canceled'
      AND NOT b.auto_renew AND b.status='active' AND w.archived_at IS NULL) AS current_binding,
    (s.site_id=a.site_id AND s.customer_id=a.customer_id AND s.subscription_id=a.subscription_id
      AND s.verified_credit_coverage @> jsonb_build_object('site_id',a.site_id,'invoice_id',a.invoice_id,
        'subscription_id',a.subscription_id,'plan',a.plan,'billing_interval','month',
        'billing_reason','subscription_cycle','coverage_verified',true)
      AND (s.verified_credit_coverage->>'period_start')::timestamptz=a.period_start
      AND (s.verified_credit_coverage->>'period_end')::timestamptz=a.period_end
      AND (s.verified_credit_coverage->>'paid_at')::timestamptz=a.paid_at
      AND p.site_id=a.site_id AND p.transaction_id='stripe_invoice_' || a.invoice_id
      AND p.transaction_type='subscription' AND p.payment_method='stripe' AND p.status='completed'
      AND p.amount=s.amount AND s.amount>0 AND p.currency=s.currency AND s.currency='USD'
      AND p.details @> jsonb_build_object('stripe_payment_intent_id',a.payment_intent_id,
        'credit_outcome','terminal_subscription')) AS proof_matches
  FROM input i JOIN public.stripe_late_renewal_access a USING (site_id,invoice_id)
  JOIN public.stripe_subscription_invoice_settlements s USING (invoice_id)
  JOIN public.payments p ON p.id=s.payment_id
  JOIN public.billing b ON b.id=a.billing_id AND b.site_id=a.site_id
  JOIN public.sites w ON w.id=a.site_id
), ledger AS (
  SELECT t.id, t.created_at, t.transaction_type, t.amount, t.metadata,
    e.site_id, e.plan_credit_period_start, e.plan_credit_period_end, e.plan_credit_source, e.plan_credit_allowance
  FROM evidence e JOIN public.credit_transactions t ON t.site_id=e.site_id
  WHERE t.created_at >= least(e.period_start,e.plan_credit_period_start)
    AND t.created_at < e.period_end
), classified AS (
  SELECT id, created_at, transaction_type, amount,
    CASE
      WHEN transaction_type='plan_credit_reset' AND metadata @> jsonb_build_object(
        'credit_bucket','plan','source',plan_credit_source,'allowance',plan_credit_allowance)
        AND (metadata->>'period_start')::timestamptz=plan_credit_period_start
        AND (metadata->>'period_end')::timestamptz=plan_credit_period_end
        AND amount=plan_credit_allowance-(metadata->>'expired_credits')::numeric THEN 'current_reset'
      WHEN transaction_type='plan_credit_expiry' AND metadata->>'credit_bucket'='plan' AND amount<0 THEN 'expiry'
      WHEN transaction_type='image_generation_settlement' AND amount=0 AND EXISTS (
        SELECT 1 FROM public.image_generation_credit_reservations r
        WHERE r.site_id=ledger.site_id AND r.operation_id=metadata->>'operation_id'
          AND r.state='settled' AND r.charged=r.amount AND r.charged=(metadata->>'charged')::numeric
      ) THEN 'settlement_memo'
      WHEN transaction_type='image_generation_hold' AND amount<0
        AND metadata ?& ARRAY['plan_spent','legacy_spent','purchased_spent','trial_spent','account_balance_spent']
        AND EXISTS (SELECT 1 FROM public.image_generation_credit_reservations r
          WHERE r.site_id=ledger.site_id AND r.operation_id=metadata->>'operation_id'
            AND r.state='settled' AND r.charged=r.amount AND r.amount=-ledger.amount
            AND r.period_start=ledger.plan_credit_period_start AND r.period_end=ledger.plan_credit_period_end
            AND r.plan_spent=(metadata->>'plan_spent')::numeric AND r.legacy_spent=(metadata->>'legacy_spent')::numeric
            AND r.purchased_spent=(metadata->>'purchased_spent')::numeric AND r.trial_spent=(metadata->>'trial_spent')::numeric
            AND r.account_balance_spent=(metadata->>'account_balance_spent')::numeric
        ) THEN 'image_hold'
      WHEN transaction_type NOT IN ('plan_credit_reset','plan_credit_expiry','image_generation_hold','image_generation_settlement')
        AND amount<0 AND metadata ?& ARRAY['plan_credits_spent','legacy_credits_spent',
        'purchased_credits_spent','trial_credits_spent','account_balance_spent'] THEN 'classified_debit'
      ELSE 'review'
    END AS kind, metadata
  FROM ledger
), spend AS (
  SELECT id, created_at, transaction_type, amount, kind,
    CASE kind WHEN 'image_hold' THEN (metadata->>'plan_spent')::numeric
      WHEN 'classified_debit' THEN (metadata->>'plan_credits_spent')::numeric END AS plan_spent,
    CASE kind WHEN 'image_hold' THEN (metadata->>'legacy_spent')::numeric
      WHEN 'classified_debit' THEN (metadata->>'legacy_credits_spent')::numeric END AS legacy_spent,
    CASE kind WHEN 'image_hold' THEN (metadata->>'purchased_spent')::numeric
      WHEN 'classified_debit' THEN (metadata->>'purchased_credits_spent')::numeric END AS purchased_spent,
    CASE kind WHEN 'image_hold' THEN (metadata->>'trial_spent')::numeric
      WHEN 'classified_debit' THEN (metadata->>'trial_credits_spent')::numeric END AS trial_spent,
    CASE WHEN kind IN ('image_hold','classified_debit') THEN (metadata->>'account_balance_spent')::numeric END AS wallet_spent
  FROM classified
), summary AS (
  SELECT count(*) FILTER (WHERE kind='current_reset') AS resets,
    count(*) FILTER (WHERE (kind='expiry' AND created_at >= (SELECT max(created_at) FROM spend WHERE kind='current_reset'))
      OR (kind IN ('review','image_hold','classified_debit') AND (
      kind='review' OR least(plan_spent,legacy_spent,purchased_spent,trial_spent,wallet_spent)<0
      OR plan_spent+legacy_spent+purchased_spent+trial_spent+wallet_spent IS DISTINCT FROM -amount
      OR created_at <= (SELECT max(created_at) FROM spend WHERE kind='current_reset')))) AS review_rows,
    sum(plan_spent) AS ledger_plan_spent,
    sum(legacy_spent) AS ledger_legacy_spent,
    sum(purchased_spent) AS ledger_purchased_spent,
    sum(trial_spent) AS ledger_trial_spent,
    sum(wallet_spent) AS ledger_wallet_spent,
    jsonb_agg(to_jsonb(spend) ORDER BY created_at,id) AS ledger_rows
  FROM spend
), result AS (
  SELECT i.site_id, i.invoice_id,
    CASE WHEN e.invoice_id IS NULL THEN 'blocked_missing_bound_proof'
    WHEN NOT coalesce(e.proof_matches AND e.current_binding AND e.not_retired,false) THEN 'blocked_proof_or_binding'
    WHEN e.reversed THEN 'blocked_reversed'
    WHEN NOT (e.paid_at <= transaction_timestamp() AND e.period_end > transaction_timestamp()) THEN 'blocked_outside_paid_service'
    WHEN e.credit_coverage_applied IS DISTINCT FROM false OR e.credits_granted IS DISTINCT FROM 0 THEN 'blocked_already_covered'
    WHEN s.resets<>1 OR s.review_rows<>0 OR s.ledger_plan_spent IS DISTINCT FROM e.plan_credits_used
      OR s.ledger_legacy_spent IS DISTINCT FROM 0 OR s.ledger_purchased_spent IS DISTINCT FROM 0
      OR s.ledger_trial_spent IS DISTINCT FROM 0 OR e.plan_credits_available IS DISTINCT FROM 0
      OR s.ledger_plan_spent+s.ledger_wallet_spent IS DISTINCT FROM e.monthly_credits_used THEN 'blocked_ledger_review'
    ELSE 'reconciled_no_safe_existing_writer' END AS outcome,
    e.paid_at, e.period_start AS invoice_service_start, e.period_end AS invoice_service_end,
    e.billing_plan, e.subscription_status, e.plan_credit_source, e.plan_credit_period_start, e.plan_credit_period_end,
    e.plan_credit_allowance, e.plan_credits_used, e.plan_credits_available, e.monthly_credits_used,
    e.purchased_credits_available, e.legacy_credits_available, e.trial_credits_available,
    e.account_balance, e.credits_available, e.invoice_allowance,
    s.ledger_plan_spent, s.ledger_legacy_spent, s.ledger_purchased_spent, s.ledger_trial_spent,
    s.ledger_wallet_spent, s.ledger_rows
  FROM input i LEFT JOIN evidence e USING (site_id,invoice_id) CROSS JOIN summary s
)
SELECT site_id, invoice_id, outcome, paid_at, invoice_service_start, invoice_service_end,
  billing_plan, subscription_status, plan_credit_source, plan_credit_period_start, plan_credit_period_end,
  plan_credit_allowance, plan_credits_used, plan_credits_available, monthly_credits_used,
  purchased_credits_available, legacy_credits_available, trial_credits_available,
  account_balance, credits_available, invoice_allowance,
  CASE WHEN outcome='reconciled_no_safe_existing_writer'
    THEN greatest(invoice_allowance-ledger_plan_spent,0) END AS theoretical_unused_before_expiry,
  ledger_plan_spent, ledger_legacy_spent, ledger_purchased_spent, ledger_trial_spent, ledger_wallet_spent, ledger_rows
FROM result;

-- Read-only comparison against repository definitions; inspect the active trigger,
-- renewal, settlement and reversal paths before designing a writer.
SELECT c.oid::regprocedure AS function, md5(c.prosrc) AS body_md5,
  (SELECT string_agg(t.tgname || ':' || t.tgenabled::text, ',' ORDER BY t.tgname) FROM pg_trigger t
    WHERE t.tgrelid='public.billing'::regclass AND t.tgfoid=c.oid AND NOT t.tgisinternal) AS billing_triggers
FROM pg_proc c
WHERE c.oid IN (to_regprocedure('public.guard_billing_credit_buckets()'),
  to_regprocedure('public.reset_site_plan_credit_period(uuid,timestamptz,timestamptz,numeric,text)'),
  to_regprocedure('public.renew_site_plan_credits(uuid)'),
  to_regprocedure('public.settle_stripe_subscription_invoice(jsonb)'),
  to_regprocedure('public.revoke_stripe_late_renewal_access(text)'))
ORDER BY 1;
ROLLBACK;