const path = require('node:path');

const HELP = `Usage: node scripts/repair-stripe-sale-wallet.cjs --site UUID --session cs_ID --project REF --mode test|live [--apply] [--confirm-live]
Optional explicit manual evidence: --verified-usd-minor INTEGER --evidence-reference REFERENCE --ack-manual-usd

Default: read-only preview. Live apply requires --apply --confirm-live.
Requires STRIPE_SECRET_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
No environment files are loaded automatically. Never pass credentials as arguments.
Re-fetches Stripe checkout and verifies identity before resolving authoritative USD.
Manual evidence must document independently verified historical USD gross, never a guessed rate.
All three manual flags are required together; never automatically falls back on errors.
No Stripe writes or journal posting.
`;
class RepairError extends Error {}
const fail = message => { throw new RepairError(message); };
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const objectId = value => typeof value === 'string' ? value : value?.id;

function parseOptions(args) {
  const options = { site: '', session: '', project: '', mode: '', apply: false, confirmLive: false, help: false,
    verifiedUsdMinor: '', evidenceReference: '', ackManualUsd: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) fail('Duplicate option. Run with --help.');
    seen.add(flag);
    if (flag === '--apply') options.apply = true;
    else if (flag === '--confirm-live') options.confirmLive = true;
    else if (flag === '--help') options.help = true;
    else if (flag === '--ack-manual-usd') options.ackManualUsd = true;
    else if (['--site', '--session', '--project', '--mode', '--verified-usd-minor', '--evidence-reference'].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) fail('Missing option value. Run with --help.');
      const key = { '--verified-usd-minor': 'verifiedUsdMinor', '--evidence-reference': 'evidenceReference' }[flag] || flag.slice(2);
      options[key] = value;
    } else fail('Unknown option. Run with --help.');
  }
  if (!options.help) validateOptions(options);
  return options;
}

function validateOptions(options) {
  if (!uuid(options.site)) fail('--site must be a UUID.');
  if (!/^cs_[A-Za-z0-9_]+$/.test(options.session)) fail('--session must be a Checkout Session ID.');
  if (!/^[a-z0-9]{20}$/.test(options.project)) fail('--project must be a Supabase project reference.');
  if (!['test', 'live'].includes(options.mode)) fail('--mode must be test or live.');
  if (options.apply && options.mode === 'live' && !options.confirmLive) fail('Live apply requires --apply --confirm-live.');
  if (options.verifiedUsdMinor || options.evidenceReference || options.ackManualUsd) {
    if (!options.ackManualUsd || !/^[1-9][0-9]*$/.test(options.verifiedUsdMinor || '') ||
        !Number.isSafeInteger(Number(options.verifiedUsdMinor)) ||
        !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,199}$/.test(options.evidenceReference || '')) {
      fail('Manual USD evidence requires --verified-usd-minor positive safe integer, --evidence-reference non-secret reference, and --ack-manual-usd.');
    }
  }
}

function validateEnvironment(env, options) {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!new RegExp(`^(sk|rk)_${options.mode}_[A-Za-z0-9]+$`).test(key || '')) {
    fail('STRIPE_SECRET_KEY must be a server key matching --mode.');
  }
  const expectedUrl = `https://${options.project}.supabase.co`;
  if (env.SUPABASE_URL?.replace(/\/$/, '') !== expectedUrl) fail('SUPABASE_URL does not match --project.');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) fail('SUPABASE_SERVICE_ROLE_KEY is required.');
  if (!serviceKey.startsWith('sb_secret_')) {
    let claims;
    try { claims = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString()); } catch { /* Fail below. */ }
    if (claims?.role !== 'service_role' || claims?.ref !== options.project) {
      fail('Supabase JWT must be service_role and match --project.');
    }
  }
  return { stripeKey: key, serviceKey, url: expectedUrl };
}

function loadResolver() {
  require('ts-node').register({
    transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
  });
  return require(path.join(__dirname, '../app/api/stripe/webhook/sale-wallet-amount.ts')).resolveStripeSaleWalletAmount;
}

async function one(query, message) {
  const { data, error } = await query.single();
  if (error || !data) fail(message);
  return data;
}

function validateCheckout(options, effect, sale, payment, session) {
  if (effect.sale_id !== sale.id || effect.sale_reference !== sale.id || sale.site_id !== options.site ||
      sale.stripe_checkout_session_id !== options.session ||
      effect.stripe_session_id !== options.session || effect.financial_status !== 'completed' ||
      effect.settlement_status !== 'settled' || effect.compensation_status !== 'not_required' || effect.stripe_refund_id ||
      payment.site_id !== options.site || payment.details?.sale_id !== sale.id ||
      payment.details?.stripe_session_id !== options.session ||
      payment.details?.stripe_payment_intent_id !== effect.payment_intent_id ||
      sale.stripe_payment_intent_id !== effect.payment_intent_id ||
      session.id !== options.session || session.mode !== 'payment' || session.status !== 'complete' ||
      session.payment_status !== 'paid' || session.livemode !== (options.mode === 'live') ||
      session.metadata?.sale_id !== sale.id || session.metadata?.site_id !== options.site ||
      session.metadata?.type !== (effect.order_id ? 'sale_order' : 'sale') ||
      (session.metadata?.order_id || null) !== (effect.order_id || null) ||
      objectId(session.payment_intent) !== effect.payment_intent_id ||
      !Number.isSafeInteger(session.amount_total) || session.amount_total <= 0 ||
      Number(effect.amount_minor) !== session.amount_total ||
      session.currency?.toLowerCase() !== effect.currency?.toLowerCase() ||
      sale.currency?.toLowerCase() !== effect.currency?.toLowerCase() ||
      Number(sale.amount_due) !== 0 || ['refunded', 'cancelled'].includes(sale.status)) {
    fail('Paid checkout identity does not match the stored sale, effect and payment.');
  }
}

async function verifyUnrefundedCharge(stripe, session) {
  const intentId = objectId(session.payment_intent);
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
  if (intent.id !== intentId || intent.status !== 'succeeded' || intent.amount !== session.amount_total ||
      intent.amount_received !== session.amount_total || intent.currency !== session.currency ||
      intent.livemode !== session.livemode) fail('Stripe PaymentIntent does not match the paid checkout.');
  const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge;
  if (!charge || objectId(charge.payment_intent) !== intentId || !charge.paid || charge.status !== 'succeeded' ||
      charge.livemode !== session.livemode || charge.currency !== session.currency ||
      charge.amount !== session.amount_total || charge.amount_captured !== session.amount_total ||
      charge.refunded !== false || charge.amount_refunded !== 0 || charge.disputed !== false) {
    fail('Stripe charge is mismatched, refunded or disputed; manual review is required.');
  }
}

async function prepareRepair({ options, supabase, stripe, resolveAmount }) {
  validateOptions(options);
  const effect = await one(supabase.from('stripe_sale_checkout_effects').select(
    'stripe_session_id,sale_reference,sale_id,order_id,payment_intent_id,amount_minor,currency,settlement_status,financial_status,compensation_status,stripe_refund_id',
  ).eq('stripe_session_id', options.session), 'Exactly one existing settlement effect is required.');
  if (!uuid(effect.sale_id)) fail('Stored effect has no valid sale ID.');
  const sale = await one(supabase.from('sales').select(
    'id,site_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_due,status,currency',
  ).eq('id', effect.sale_id).eq('site_id', options.site), 'Existing sale does not match --site.');
  const suffix = effect.order_id || options.session;
  const payment = await one(supabase.from('payments').select(
    'site_id,transaction_id,amount,currency,details',
  ).eq('transaction_id', `sale_${sale.id}_${suffix}`).eq('site_id', options.site), 'Exactly one existing sale ledger row is required.');
  const commission = await one(supabase.from('payments').select('amount,currency,details')
    .eq('transaction_id', `commission_${sale.id}_${suffix}`).eq('site_id', options.site), 'Exactly one existing commission ledger row is required.');
  // Always re-fetch, including preview and audit replays. Metadata is checked
  // against DB identity, never used to discover or choose a tenant.
  const session = await stripe.checkout.sessions.retrieve(options.session);
  validateCheckout(options, effect, sale, payment, session);
  await verifyUnrefundedCharge(stripe, session);
  // Manual evidence is an explicit alternative, not a catch/fallback. Identity
  // and refund checks above remain mandatory even when USD evidence is manual.
  const resolved = options.ackManualUsd
    ? { amount: Number(options.verifiedUsdMinor) / 100, currency: 'USD' }
    : await resolveAmount(stripe, session);
  const minor = options.ackManualUsd ? Number(options.verifiedUsdMinor) : Math.round(resolved.amount * 100);
  if (resolved.currency !== 'USD' || !Number.isSafeInteger(minor) || minor <= 0 ||
      Math.abs(resolved.amount * 100 - minor) > 0.000001) fail('Resolver did not supply a positive integer USD minor amount.');
  const original = payment.details?.fx_repair?.original;
  if (payment.details?.fx_repair && (!original || !original.gross || !original.commission)) {
    fail('Existing repair audit is malformed.');
  }
  return {
    p_site_id: options.site, p_session_id: options.session,
    p_expected_gross: original ? original.gross.amount : payment.amount,
    p_expected_commission: original ? original.commission.amount : commission.amount,
    p_expected_currency: original ? original.gross.currency : payment.currency,
    p_usd_amount_minor: minor,
    p_evidence: {
      source: options.ackManualUsd ? 'verified_operator_usd' : 'resolveStripeSaleWalletAmount',
      ...(options.ackManualUsd ? { evidence_reference: options.evidenceReference, ack_manual_usd: true } : {}),
      project: options.project, mode: options.mode,
      site_id: options.site, session_id: options.session, sale_id: sale.id,
      payment_intent_id: effect.payment_intent_id, checkout_amount_minor: session.amount_total,
      checkout_currency: session.currency.toLowerCase(), usd_amount_minor: minor,
      captured_at: new Date().toISOString(),
    },
    p_apply: false,
  };
}

async function runRepair(dependencies) {
  const args = await prepareRepair(dependencies);
  const call = async apply => {
    const { data, error } = await dependencies.supabase.rpc('repair_stripe_sale_wallet_currency', { ...args, p_apply: apply });
    if (error || !data) fail('Wallet repair RPC refused the operation; inspect the approved database audit workflow.');
    return data;
  };
  const preview = await call(false);
  if (!['preview', 'already_repaired'].includes(preview.status)) fail('Unexpected preview response.');
  if (!dependencies.options.apply || preview.status === 'already_repaired') return preview;
  const result = await call(true);
  if (!['repaired', 'already_repaired'].includes(result.status)) fail('Unexpected apply response.');
  return result;
}

async function main(args = process.argv.slice(2), env = process.env) {
  const options = parseOptions(args);
  if (options.help) { console.log(HELP); return; }
  const credentials = validateEnvironment(env, options);
  const Stripe = require('stripe');
  const { createClient } = require('@supabase/supabase-js');
  const result = await runRepair({ options,
    stripe: new Stripe(credentials.stripeKey, { maxNetworkRetries: 2, timeout: 20000 }),
    supabase: createClient(credentials.url, credentials.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    resolveAmount: loadResolver(),
  });
  // Do not print complete ledger rows or provider payloads (audit stays in DB).
  console.log(JSON.stringify({ status: result.status, site: options.site, session: options.session,
    usd_amount_minor: result.audit?.usd_amount_minor, new_commission: result.new_commission,
    balance_delta: result.audit?.balance_delta, balance_before: result.audit?.balance_before,
    balance_after: result.audit?.balance_after, commission_expense_id: result.audit?.original?.expense?.id,
  }, null, 2));
}

if (require.main === module) main().catch(error => {
  console.error(error instanceof RepairError ? error.message : 'Repair stopped: Stripe USD evidence or local runtime unavailable. No fallback conversion was attempted.');
  process.exitCode = 1;
});

module.exports = { parseOptions, validateEnvironment, validateCheckout, prepareRepair, runRepair, loadResolver };