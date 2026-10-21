const assert = require('node:assert/strict');
const { coveragePatch, coverageMatches, FINANCIAL_FIELDS } = require('./repair-legacy-subscription-coverage.cjs');

// Explicitly authorized server-only recovery of an already-paid, already-credited
// monthly invoice without a settlement marker. Never manufacture a marker/grant.
const EXACT_FIELDS = FINANCIAL_FIELDS.filter(key => !key.startsWith('plan_credit_period_'));
const BILLING_SELECT = `*,${EXACT_FIELDS.map(key => `_exact_${key}:${key}::text`).join(',')}`;
const COVERAGE_FIELDS = ['paid_subscription_invoice_id', 'paid_subscription_plan', 'paid_subscription_addons_count',
  'paid_subscription_period_start', 'paid_subscription_period_end', 'paid_subscription_paid_at'];
const sameTime = (a, b) => a != null && b != null && Date.parse(a) === Date.parse(b);
const exactBilling = row => {
  for (const key of EXACT_FIELDS) if (row[`_exact_${key}`] != null) {
    row[key] = row[`_exact_${key}`]; delete row[`_exact_${key}`];
  }
  return row;
};
const unwrap = async query => {
  const { data, error } = await query;
  assert.ok(!error && data, 'Scoped recovery read/write failed; inspect before retry');
  return data;
};

function validateUnmarkedRecovery({ billing, payment, grants, settlements, evidence, now = Date.now() }) {
  assert.equal(evidence.coverage_verified, true);
  assert.equal(evidence.refunds_checked, true);
  assert.equal(evidence.disputes_checked, true);
  const verified = Date.parse(evidence.verified_at);
  assert.ok(verified <= now && now - verified <= 15 * 60000, 'Fresh live Stripe verification required');
  assert.ok(Date.parse(evidence.period_start) <= now && Date.parse(evidence.period_end) > now);
  assert.ok(Number.isFinite(Date.parse(evidence.paid_at)));
  assert.equal(evidence.billing_reason, 'subscription_cycle');
  assert.equal(evidence.billing_interval, 'month');
  assert.equal(evidence.current_subscription_status, 'active');
  assert.equal(evidence.current_service.plan, evidence.plan);
  assert.equal(evidence.current_service.addons_count, evidence.addons_count);
  assert.equal(evidence.current_service.billing_interval, 'month');
  assert.equal(billing.site_id, evidence.site_id);
  assert.equal(billing.stripe_customer_id, evidence.customer_id);
  assert.equal(billing.stripe_subscription_id, evidence.subscription_id);
  assert.equal(billing.status, 'active'); assert.equal(billing.subscription_status, 'active');
  assert.equal(billing.plan, evidence.plan); assert.equal(billing.addons_count, evidence.addons_count);
  assert.equal(billing.billing_interval, 'month');
  assert.ok(sameTime(billing.plan_credit_period_start, evidence.period_start));
  assert.ok(sameTime(billing.plan_credit_period_end, evidence.period_end));
  assert.ok(coverageMatches(billing, evidence) || COVERAGE_FIELDS.every(key => billing[key] == null));
  assert.ok(billing.plan_credit_anchor == null || sameTime(billing.plan_credit_anchor, evidence.period_start));
  assert.equal(settlements.length, 0, 'Marked invoices require the canonical recovery flow');
  assert.equal(payment.site_id, evidence.site_id);
  assert.equal(payment.transaction_id, `stripe_invoice_${evidence.invoice_id}`);
  assert.equal(payment.transaction_type, 'subscription'); assert.equal(payment.status, 'completed');
  assert.equal(payment.currency, evidence.currency); assert.equal(Number(payment.amount), evidence.amount);
  assert.equal(payment.credits, 0, 'Only the audited legacy zero-credit payment shape is supported');
  assert.equal(payment.details.stripe_invoice_id, evidence.invoice_id);
  assert.equal(payment.details.stripe_customer_id, evidence.customer_id);
  assert.equal(payment.details.stripe_subscription_id, evidence.subscription_id);
  assert.equal(payment.details.stripe_payment_intent_id, evidence.payment_intent_id);
  assert.equal(grants.length, 1, 'Exactly one prior invoice grant is required');
  assert.equal(grants[0].site_id, evidence.site_id);
  assert.equal(grants[0].transaction_type, 'subscription_renewal_recovery');
  assert.equal(grants[0].metadata.stripe_invoice_id, evidence.invoice_id);
  assert.ok(/^evt_[A-Za-z0-9]+$/.test(grants[0].metadata.stripe_event_id));
  assert.equal(Number(grants[0].amount), Number(billing.plan_credit_allowance));
  assert.ok(Number(grants[0].amount) > 0);
  return coveragePatch(evidence);
}

async function runUnmarkedRecovery({ supabase, evidence, apply = false }) {
  const billing = exactBilling(await unwrap(supabase.from('billing').select(BILLING_SELECT)
    .eq('site_id', evidence.site_id).single()));
  const payment = await unwrap(supabase.from('payments').select('*').eq('site_id', evidence.site_id)
    .eq('transaction_id', `stripe_invoice_${evidence.invoice_id}`).single());
  const grants = await unwrap(supabase.from('credit_transactions').select('*').eq('site_id', evidence.site_id)
    .eq('metadata->>stripe_invoice_id', evidence.invoice_id).gt('amount', 0));
  const settlements = await unwrap(supabase.from('stripe_subscription_invoice_settlements').select('*')
    .eq('invoice_id', evidence.invoice_id));
  const patch = validateUnmarkedRecovery({ billing, payment, grants, settlements, evidence });
  if (!apply) return { status: 'preview', credits_granted: 0 };
  if (!coverageMatches(billing, evidence)) {
    let update = supabase.from('billing').update(patch).eq('id', billing.id).eq('site_id', evidence.site_id)
      .eq('stripe_customer_id', evidence.customer_id).eq('stripe_subscription_id', evidence.subscription_id)
      .eq('plan', evidence.plan).eq('addons_count', evidence.addons_count)
      .eq('subscription_status', 'active').eq('status', 'active').eq('billing_interval', 'month');
    for (const field of [...FINANCIAL_FIELDS, ...COVERAGE_FIELDS, 'updated_at', 'plan_credit_source', 'plan_credit_anchor'])
      update = billing[field] == null ? update.is(field, null) : update.eq(field, billing[field]);
    const repaired = exactBilling(await unwrap(update.select(BILLING_SELECT).single()));
    assert.ok(coverageMatches(repaired, evidence));
    for (const field of FINANCIAL_FIELDS) assert.equal(repaired[field], billing[field], `Changed ${field}`);
  }
  // Old installations do not reconcile on coverage-only updates. Re-run the
  // existing protected settings trigger without overwriting concurrent edits.
  const settings = await unwrap(supabase.from('settings').select('id,channels').eq('site_id', evidence.site_id).single());
  await unwrap(supabase.from('settings').update({ channels: settings.channels })
    .eq('id', settings.id).eq('site_id', evidence.site_id).eq('channels', JSON.stringify(settings.channels)).select('id').single());
  const projection = await unwrap(supabase.rpc('get_site_licensed_resources', { p_site_id: evidence.site_id }));
  assert.equal(projection.effective_plan, evidence.plan);
  const after = exactBilling(await unwrap(supabase.from('billing').select(BILLING_SELECT).eq('site_id', evidence.site_id).single()));
  assert.ok(coverageMatches(after, evidence));
  for (const field of FINANCIAL_FIELDS) assert.equal(after[field], billing[field], `Concurrent financial change: ${field}`);
  return { status: 'repaired', credits_granted: 0, settlement_created: false,
    effective_plan: projection.effective_plan,
    channels: projection.channels.connections.map(channel => ({ id: channel.id, type: channel.type,
      status: channel.status, license_suspended: channel.license_suspended })) };
}

module.exports = { validateUnmarkedRecovery, runUnmarkedRecovery };