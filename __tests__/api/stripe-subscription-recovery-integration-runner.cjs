const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

// Actual producer + SQL, disposable in-memory PostgreSQL. No dotenv/network.
const root = path.resolve(__dirname, '../..')
const api = path.resolve(process.argv[2])
const { PGlite } = require(path.join(api, 'node_modules/@electric-sql/pglite'))
const ts = require(path.join(root, 'node_modules/typescript'))
const resolve = Module._resolveFilename
const load = Module._load
Module._resolveFilename = function (id, parent, ...rest) {
  return resolve.call(this, id.startsWith('@/') ? path.join(root, id.slice(2)) : id, parent, ...rest)
}
Module._load = function (id, parent, ...rest) {
  return id === 'server-only' ? {} : load.call(this, id, parent, ...rest)
}
require.extensions['.ts'] = function (mod, file) {
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file)
}
for (const key of Object.keys(process.env)) if (key.startsWith('STRIPE_')) delete process.env[key]
process.env.STRIPE_STARTER_PRICE_ID = 'priceEngineMonth'
process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = 'priceEngineYear'
process.env.STRIPE_STARTUP_ANNUAL_PRICE_ID = 'priceFoundryYear'
process.env.STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID = 'priceAddonYear'
const { settleStripeSubscriptionInvoice } = require(path.join(root, 'app/api/stripe/webhook/subscription-invoice-settlement.ts'))
const { configuredSubscriptionPrice } = require(path.join(root, 'lib/subscription-pricing.server.ts'))
const id = prefix => `${prefix}_${randomUUID().replaceAll('-', '')}`
const db = new PGlite()
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
let checks = 0
async function main() {
  await db.exec(readFileSync(path.join(api, 'src/lib/services/billing/__tests__/credit-fixture.sql'), 'utf8'))
  for (const name of ['20261003230000_credit_buckets_and_monthly_reset.sql',
    '20261003230001_stripe_plan_credit_reset.sql', '20261003230002_classified_credit_operations.sql',
    '20261005230000_exact_credit_accounting_precision.sql', '20261007003000_remove_signup_credit_bonus.sql',
    '20261007180000_annual_subscription_credit_periods.sql',
    '20261009040000_one_monthly_credit_per_addon.sql',
    '20261009070000_preserve_paid_addon_credit_windows.sql']) {
    await db.exec(readFileSync(path.join(api, 'supabase/migrations', name), 'utf8'))
  }
  for (const [plan, addons, expected] of [['engine', 0, 20], ['engine', 2, 22],
    ['foundry', 2, 102], ['enterprise', 1, 501], ['commission', 2, 1], ['unlisted', 3, 0]]) {
    const result = await one('SELECT site_plan_credit_allowance($1,$2) value', [plan, addons])
    assert.equal(Number(result.value), expected)
  }
  for (const role of ['anon', 'authenticated']) {
    const access = await one("SELECT has_function_privilege($1,'public.site_plan_credit_allowance(text,integer)','EXECUTE') ok", [role])
    assert.equal(access.ok, false)
  }
  const times = await one(`SELECT floor(extract(epoch from now()-interval '1 day'))::int start,
    floor(extract(epoch from now()-interval '1 day'+interval '1 year'))::int finish`)
  const price = priceId => {
    const c = configuredSubscriptionPrice(priceId)
    return { id: priceId, active: true, currency: 'usd', type: 'recurring', billing_scheme: 'per_unit',
      unit_amount: c.amount, recurring: { interval: c.interval, interval_count: 1, usage_type: 'licensed' } }
  }
  for (const mismatch of ['tier', 'interval', 'addons']) {
    const siteId = randomUUID(), customerId = id('cus'), subscriptionId = id('sub'), invoiceId = id('in')
    await db.query("INSERT INTO sites(id,name) VALUES($1,'Synthetic recovery integration')", [siteId])
    await db.query('SELECT initialize_site_billing($1)', [siteId])
    await db.query(`UPDATE billing SET stripe_customer_id=$2,stripe_subscription_id=$3,subscription_status='paused',
      purchased_credits_available=40,legacy_credits_available=7,credits_available=plan_credits_available+47,
      account_balance=17.42 WHERE site_id=$1`, [siteId, customerId, subscriptionId])
    const invoiceBase = mismatch === 'tier' ? 'priceFoundryYear' : 'priceEngineYear'
    const invoiceAddons = mismatch === 'addons' ? 2 : 0
    let currentBase = invoiceBase, currentAddons = invoiceAddons, currentStatus = 'paused'
    const serviceLine = (priceId, quantity) => ({ id: id('il'), amount: price(priceId).unit_amount * quantity,
      quantity, currency: 'usd', discountable: true, period: { start: times.start, end: times.finish },
      pricing: { price_details: { price: priceId }, unit_amount_decimal: String(price(priceId).unit_amount) },
      parent: { subscription_item_details: { subscription: subscriptionId, proration: false } } })
    const lines = [serviceLine(invoiceBase, 1), ...(invoiceAddons ? [serviceLine('priceAddonYear', invoiceAddons)] : [])]
    const paid = { id: invoiceId, customer: customerId, status: 'paid', amount_paid: 100, amount_due: 100,
      currency: 'usd', billing_reason: 'subscription_update', status_transitions: { paid_at: times.start },
      parent: { subscription_details: { subscription: subscriptionId } }, lines: { has_more: false, data: lines } }
    const stripe = {
      invoices: { retrieve: async () => paid }, prices: { retrieve: async priceId => price(priceId) },
      customers: { retrieve: async () => ({ id: customerId, metadata: { site_id: siteId } }) },
      subscriptions: { retrieve: async () => ({ id: subscriptionId, customer: customerId, status: currentStatus,
        start_date: times.start, ended_at: null, cancel_at_period_end: false, cancel_at: null,
        items: { has_more: false, data: [{ price: price(currentBase), quantity: 1, current_period_end: times.finish },
          ...(currentAddons ? [{ price: price('priceAddonYear'), quantity: currentAddons, current_period_end: times.finish }] : [])] } }) },
    }
    const inputs = []
    const supabase = {
      from: table => {
        assert.equal(table, 'billing')
        return { select: () => ({ eq: (column, value) => ({ single: async () => {
          assert.equal(column, 'site_id'); assert.equal(value, siteId)
          return { data: await one('SELECT stripe_customer_id,stripe_subscription_id FROM billing WHERE site_id=$1', [siteId]), error: null }
        } }) }) }
      },
      rpc: async (name, args) => {
        if (name === 'sync_stripe_subscription_state') {
          const keys = ['p_site_id', 'p_customer_id', 'p_subscription_id', 'p_expected_subscription_id', 'p_status',
            'p_current_period_end', 'p_start_date', 'p_end_date', 'p_auto_renew', 'p_invoice_id']
          return { data: (await one(`SELECT sync_stripe_subscription_state(${keys.map((_, i) => `$${i+1}`).join(',')}) result`,
            keys.map(key => args[key] ?? null))).result, error: null }
        }
        assert.equal(name, 'settle_stripe_subscription_invoice'); inputs.push(args.p_invoice)
        return { data: (await one('SELECT settle_stripe_subscription_invoice($1::jsonb) result', [args.p_invoice])).result, error: null }
      },
    }
    const settle = () => settleStripeSubscriptionInvoice({ stripe, supabase, invoiceId, requirePaid: true })
    const state = async () => ({
      billing: await one('SELECT * FROM billing WHERE site_id=$1', [siteId]),
      payment: await one('SELECT * FROM payments WHERE site_id=$1', [siteId]),
      marker: await one('SELECT * FROM stripe_subscription_invoice_settlements WHERE invoice_id=$1', [invoiceId]),
      ledger: await one('SELECT count(*)::int n FROM credit_transactions WHERE site_id=$1', [siteId]),
    })
    const first = await settle()
    assert.equal(first.outcome, 'settled'); assert.equal(first.credits_granted, 0)
    const before = await state()
    assert.equal(before.marker.credit_coverage_applied, false)
    assert.equal(before.marker.verified_credit_coverage.coverage_verified, true)
    currentStatus = 'active'
    if (mismatch === 'tier') currentBase = 'priceEngineYear'
    if (mismatch === 'interval') currentBase = 'priceEngineMonth'
    if (mismatch === 'addons') currentAddons = 0
    const blocked = await settle()
    assert.equal(blocked.outcome, 'duplicate'); assert.equal(blocked.credits_granted, 0)
    const after = await state()
    assert.equal(after.billing.plan, before.billing.plan)
    assert.equal(after.billing.paid_subscription_invoice_id, null)
    assert.equal(after.billing.plan_credits_available, before.billing.plan_credits_available)
    assert.deepEqual(after.payment, before.payment)
    assert.deepEqual(after.marker, before.marker)
    assert.deepEqual(after.ledger, before.ledger)
    assert.equal(inputs.at(-1).coverage_verified, true)
    assert.notDeepEqual(inputs.at(-1).current_service, {
      plan: before.marker.verified_credit_coverage.plan,
      addons_count: before.marker.verified_credit_coverage.addons_count,
      billing_interval: before.marker.verified_credit_coverage.billing_interval,
    })
    currentBase = invoiceBase; currentAddons = invoiceAddons
    const recovered = await settle()
    const expectedCredits = (mismatch === 'tier' ? 100 : 20) + invoiceAddons
    assert.equal(recovered.outcome, 'duplicate'); assert.equal(recovered.coverage_recovered, true)
    assert.equal(recovered.credits_granted, expectedCredits)
    const final = await state()
    assert.equal(final.billing.plan, mismatch === 'tier' ? 'foundry' : 'engine')
    assert.equal(Number(final.billing.plan_credits_available), expectedCredits)
    assert.equal(Number(final.billing.purchased_credits_available), 40)
    assert.equal(Number(final.billing.legacy_credits_available), 7)
    assert.equal(Number(final.billing.account_balance), 17.42)
    assert.equal(final.marker.credit_coverage_applied, true)
    assert.deepEqual(final.marker.verified_credit_coverage, before.marker.verified_credit_coverage)
    assert.equal((await settle()).credits_granted, 0)
    const duplicate = await state()
    assert.deepEqual(duplicate.marker, final.marker); assert.deepEqual(duplicate.payment, final.payment)
    assert.deepEqual(duplicate.ledger, final.ledger)
    checks++; console.log(`PASS actual producer + SQL immutable update recovery current ${mismatch} fence`)
  }
  console.log(`PASS ${checks} integrated recovery cases`)
}
main().then(() => db.close()).catch(async error => { console.error(error); await db.close(); process.exitCode = 1 })