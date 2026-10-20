const assert = require('node:assert/strict');

// Server-only operator repair. Evidence must come from the existing Stripe
// retrieval/price/service-line verifiers, never a browser or stored plan alone.
const FINANCIAL_FIELDS = [
  'credits_available', 'credits_used', 'plan_credits_available', 'plan_credits_used',
  'plan_credit_allowance', 'monthly_credits_used', 'purchased_credits_available',
  'legacy_credits_available', 'trial_credits_available', 'account_balance',
  'plan_credit_period_start', 'plan_credit_period_end',
];
const COVERAGE_FIELDS = [
  'paid_subscription_invoice_id', 'paid_subscription_plan', 'paid_subscription_addons_count',
  'paid_subscription_period_start', 'paid_subscription_period_end', 'paid_subscription_paid_at',
];
const EXACT_FIELDS = FINANCIAL_FIELDS.filter(key => !key.startsWith('plan_credit_period_'));
const BILLING_SELECT = `*,${EXACT_FIELDS.map(key => `_exact_${key}:${key}::text`).join(',')}`;
function exactBilling(row) {
  // PostgreSQL numeric can exceed JavaScript's precision. Preserve text values
  // for CAS filters and before/after checks instead of rounded JSON numbers.
  for (const key of EXACT_FIELDS) if (row[`_exact_${key}`] != null) {
    row[key] = row[`_exact_${key}`];
    delete row[`_exact_${key}`];
  }
  return row;
}
const sameTime = (a, b) => a != null && b != null && Date.parse(a) === Date.parse(b);

function coveragePatch(evidence) {
  return {
    paid_subscription_invoice_id: evidence.invoice_id,
    paid_subscription_plan: evidence.plan,
    paid_subscription_addons_count: evidence.addons_count,
    paid_subscription_period_start: evidence.period_start,
    paid_subscription_period_end: evidence.period_end,
    paid_subscription_paid_at: evidence.paid_at,
    plan_credit_anchor: evidence.period_start,
    plan_credit_source: `stripe_invoice:${evidence.invoice_id}`,
  };
}

function coverageMatches(billing, evidence) {
  const patch = coveragePatch(evidence);
  return Object.entries(patch).every(([key, value]) =>
    key.includes('period_') || key === 'paid_subscription_paid_at' || key === 'plan_credit_anchor'
      ? sameTime(billing[key], value) : billing[key] === value);
}

function validateRepair({ billing, settlement, payment, ledger, evidence, now = Date.now() }) {
  assert.equal(evidence.coverage_verified, true, 'Authoritative invoice coverage is required');
  const verifiedAt = Date.parse(evidence.verified_at);
  assert.ok(verifiedAt <= now && now - verifiedAt <= 15 * 60000, 'Re-fetch stale Stripe evidence');
  assert.ok(Date.parse(evidence.period_start) <= now && Date.parse(evidence.period_end) > now,
    'Paid service must cover the current time');
  assert.ok(Number.isFinite(Date.parse(evidence.paid_at)), 'Verified paid timestamp is required');
  assert.equal(evidence.billing_interval, 'month', 'Annual legacy windows require separate review');
  assert.equal(evidence.billing_reason, 'subscription_cycle', 'Only an existing full renewal is repairable');
  assert.equal(evidence.current_subscription_status, 'active');
  assert.equal(evidence.current_service.plan, evidence.plan);
  assert.equal(evidence.current_service.addons_count, evidence.addons_count);
  assert.equal(evidence.current_service.billing_interval, evidence.billing_interval);
  assert.equal(billing.site_id, evidence.site_id);
  assert.equal(billing.stripe_customer_id, evidence.customer_id);
  assert.equal(billing.stripe_subscription_id, evidence.subscription_id);
  assert.equal(billing.plan, evidence.plan);
  assert.equal(billing.addons_count, evidence.addons_count);
  assert.equal(billing.billing_interval, evidence.billing_interval);
  assert.equal(billing.status, 'active');
  assert.equal(billing.subscription_status, 'active');
  assert.equal(billing.trial_started_at, null, 'An active trial needs coordinated settlement');
  assert.equal(Number(billing.trial_credits_available), 0);
  assert.ok(sameTime(billing.plan_credit_period_start, evidence.period_start), 'Credit period start differs');
  assert.ok(sameTime(billing.plan_credit_period_end, evidence.period_end), 'Credit period end differs');
  assert.ok(coverageMatches(billing, evidence) || COVERAGE_FIELDS.every(key => billing[key] == null),
    'Existing paid coverage must not be overwritten');
  assert.ok(billing.plan_credit_anchor == null || sameTime(billing.plan_credit_anchor, evidence.period_start));
  assert.equal(settlement.site_id, evidence.site_id);
  assert.equal(settlement.invoice_id, evidence.invoice_id);
  assert.equal(settlement.customer_id, evidence.customer_id);
  assert.equal(settlement.subscription_id, evidence.subscription_id);
  assert.equal(settlement.currency, evidence.currency);
  assert.equal(Number(settlement.amount), evidence.amount);
  assert.equal(settlement.payment_id, payment.id);
  assert.equal(payment.site_id, evidence.site_id);
  assert.equal(payment.transaction_id, `stripe_invoice_${evidence.invoice_id}`);
  assert.equal(payment.transaction_type, 'subscription');
  assert.equal(payment.status, 'completed');
  assert.equal(Number(payment.amount), evidence.amount);
  assert.equal(payment.currency, evidence.currency);
  assert.equal(ledger.length, 1, 'Exactly one historical invoice credit grant is required');
  assert.equal(ledger[0].metadata.stripe_invoice_id, evidence.invoice_id);
  assert.equal(ledger[0].metadata.payment_id, payment.id);
  assert.equal(Number(ledger[0].amount), Number(settlement.credits_granted));
  assert.equal(Number(payment.credits), Number(settlement.credits_granted));
  assert.equal(Number(billing.plan_credit_allowance), Number(settlement.credits_granted));
  assert.ok(Number(settlement.credits_granted) > 0);
  assert.ok(settlement.verified_credit_coverage == null || settlement.credit_coverage_applied === true,
    'Unapplied immutable coverage must use the normal recovery flow');
  if (settlement.credit_coverage_applied) assert.ok(coverageMatches(billing, evidence));
  return coveragePatch(evidence);
}

async function one(query) {
  const { data, error } = await query.single();
  if (error || !data) throw new Error(`Scoped repair read/write failed (${error?.code ?? 'no-row'}: ${error?.message ?? 'Concurrent change or missing row'}); re-verify before retry`);
  return data;
}

async function runRepair({ supabase, evidence, apply = false }) {
  const billing = exactBilling(await one(supabase.from('billing').select(BILLING_SELECT).eq('site_id', evidence.site_id)));
  const settlement = await one(supabase.from('stripe_subscription_invoice_settlements').select('*')
    .eq('invoice_id', evidence.invoice_id).eq('site_id', evidence.site_id));
  const payment = await one(supabase.from('payments').select('*').eq('id', settlement.payment_id)
    .eq('site_id', evidence.site_id));
  const { data: ledger, error } = await supabase.from('credit_transactions').select('*')
    .eq('site_id', evidence.site_id).eq('metadata->>stripe_invoice_id', evidence.invoice_id).gt('amount', 0);
  if (error) throw new Error('Historical credit ledger is unavailable');
  const patch = validateRepair({ billing, settlement, payment, ledger, evidence });
  if (!apply) return { status: 'preview', credits_granted: 0, coverage_already_present: coverageMatches(billing, evidence) };
  if (!coverageMatches(billing, evidence)) {
    let update = supabase.from('billing').update(patch).eq('id', billing.id)
      .eq('site_id', evidence.site_id).eq('stripe_customer_id', evidence.customer_id)
      .eq('stripe_subscription_id', evidence.subscription_id).eq('subscription_status', 'active').eq('status', 'active')
      .eq('plan', evidence.plan).eq('addons_count', evidence.addons_count).is('paid_subscription_invoice_id', null);
    // Reject concurrent usage, renewal or coverage changes. No balance is written.
    for (const field of [...FINANCIAL_FIELDS, 'updated_at', 'plan_credit_source', 'plan_credit_anchor'])
      update = billing[field] == null ? update.is(field, null) : update.eq(field, billing[field]);
    const repaired = exactBilling(await one(update.select(BILLING_SELECT)));
    assert.ok(coverageMatches(repaired, evidence), 'Paid coverage did not persist');
    for (const field of FINANCIAL_FIELDS) assert.deepEqual(repaired[field], billing[field], `Changed ${field}`);
  }
  // Separate requests intentionally support interruption: null proof still makes
  // the normal handler a no-op. Attach proof AND applied together only after the
  // same already-credited window is persisted, never expose an unapplied proof.
  if (!settlement.credit_coverage_applied) {
    const proof = Object.fromEntries(['site_id', 'subscription_id', 'invoice_id', 'plan', 'addons_count',
      'billing_interval', 'billing_reason', 'period_start', 'period_end', 'paid_at', 'coverage_verified']
      .map(key => [key, evidence[key]]));
    await one(supabase.from('stripe_subscription_invoice_settlements').update({
      verified_credit_coverage: proof, credit_coverage_applied: true,
    }).eq('invoice_id', evidence.invoice_id).eq('site_id', evidence.site_id)
      .eq('payment_id', payment.id).eq('credits_granted', settlement.credits_granted)
      .eq('credit_coverage_applied', false).is('verified_credit_coverage', null).select('*'));
  }
  return { status: 'repaired', credits_granted: 0 };
}

module.exports = { validateRepair, coveragePatch, coverageMatches, runRepair, FINANCIAL_FIELDS };