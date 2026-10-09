const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

// Real TypeScript producer and SQL, disposable in-memory PostgreSQL. No network.
const root = path.resolve(__dirname, '../..')
const api = path.resolve(process.argv[2])
const { PGlite } = require(path.join(api, 'node_modules/@electric-sql/pglite'))
const ts = require(path.join(root, 'node_modules/typescript'))
const resolve = Module._resolveFilename
const load = Module._load
Module._resolveFilename = function (id, parent, ...rest) {
  return resolve.call(this, id.startsWith('@/') ? path.join(root, id.slice(2)) : id, parent, ...rest)
}
Module._load = function (id, parent, ...rest) { return id === 'server-only' ? {} : load.call(this, id, parent, ...rest) }
require.extensions['.ts'] = function (mod, file) {
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file)
}
for (const key of Object.keys(process.env)) if (key.startsWith('STRIPE_')) delete process.env[key]
process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = 'priceFreeMonth'
process.env.STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID = 'priceFreeYear'
const { settleStripeSubscriptionInvoice } = require(path.join(root, 'app/api/stripe/webhook/subscription-invoice-settlement.ts'))
const db = new PGlite()
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const uid = prefix => `${prefix}_${randomUUID().replaceAll('-', '')}`
const iso = seconds => new Date(seconds * 1000).toISOString()
async function main() {
  await db.exec(readFileSync(path.join(api, 'src/lib/services/billing/__tests__/credit-fixture.sql'), 'utf8'))
  for (const name of ['20261003230000_credit_buckets_and_monthly_reset.sql',
    '20261003230001_stripe_plan_credit_reset.sql', '20261003230002_classified_credit_operations.sql',
    '20261005230000_exact_credit_accounting_precision.sql', '20261007003000_remove_signup_credit_bonus.sql',
    '20261007180000_annual_subscription_credit_periods.sql', '20261008210000_preserve_canceled_subscription_credit_usage.sql',
    '20261009040000_one_monthly_credit_per_addon.sql', '20261009070000_preserve_paid_addon_credit_windows.sql']) {
    await db.exec(readFileSync(path.join(api, 'supabase/migrations', name), 'utf8'))
  }
  const forward = readFileSync(path.join(root, 'supabase/migrations/20261009080000_free_plan_paid_addons.sql'), 'utf8')
  await db.exec(forward)
  await db.exec(forward) // Safe replacement/grants/check are rerunnable; no backfill.
  assert.equal(Number((await one("SELECT site_plan_credit_allowance('commission',2) n")).n), 3)
  assert.equal(Number((await one("SELECT site_plan_credit_allowance('engine',2) n")).n), 22)
  for (const role of ['anon', 'authenticated']) {
    for (const fn of ['settle_stripe_subscription_invoice(jsonb)', 'apply_paid_subscription_credit_coverage(jsonb)', 'site_plan_credit_allowance(text,integer)']) {
      assert.equal((await one('SELECT has_function_privilege($1,$2,\'EXECUTE\') ok', [role, `public.${fn}`])).ok, false)
    }
  }
  const now = Number((await one('SELECT floor(extract(epoch from now()))::int n')).n)
  const start = now - 3600
  let last
  for (const interval of ['month', 'year']) {
    const site = randomUUID(), customer = uid('cus'), subscription = uid('sub')
    const endDate = new Date(start * 1000)
    endDate.setUTCMonth(endDate.getUTCMonth() + (interval === 'year' ? 12 : 1))
    const end = endDate.getTime() / 1000
    const price = { id: interval === 'year' ? 'priceFreeYear' : 'priceFreeMonth', active: true, currency: 'usd',
      type: 'recurring', billing_scheme: 'per_unit', unit_amount: interval === 'year' ? 10800 : 1000,
      recurring: { interval, interval_count: 1, usage_type: 'licensed' } }
    await db.query('INSERT INTO sites(id) VALUES ($1)', [site])
    await db.query(`INSERT INTO billing(site_id,plan,status,stripe_customer_id,plan_credits_used,monthly_credits_used,
      plan_credit_allowance,plan_credits_available,purchased_credits_available,legacy_credits_available,
      credits_available,account_balance,plan_credit_period_start,plan_credit_period_end,plan_credit_source)
      VALUES($1,'commission','active',$2,0.75,0.75,1,0.25,40,7,47.25,17.42,date_trunc('month',now()),
        date_trunc('month',now())+interval '1 month','workflow')`, [site, customer])
    let count = 2, status = 'active', invoiceId = uid('in'), reason = 'subscription_create', paid = true, paidAt = start + 1
    let invoiceStart = start, invoiceEnd = end
    let invoiceCount = count
    const subscriptionObject = () => ({ id: subscription, customer, status, start_date: start,
      latest_invoice: invoiceId, items: { has_more: false, data: [{ id: 'si_free', price, quantity: count,
        current_period_start: invoiceStart, current_period_end: invoiceEnd }] } })
    const stripe = {
      prices: { retrieve: async id => { assert.equal(id, price.id); return price } },
      subscriptions: { retrieve: async id => { assert.equal(id, subscription); return subscriptionObject() } },
      customers: { retrieve: async id => { assert.equal(id, customer); return { id, metadata: { site_id: site } } } },
      invoices: { retrieve: async id => {
        assert.equal(id, invoiceId)
        return { id, customer, parent: { subscription_details: { subscription } }, status: paid ? 'paid' : 'open',
          currency: 'usd', amount_paid: price.unit_amount * invoiceCount, amount_due: price.unit_amount * invoiceCount,
          billing_reason: reason, status_transitions: { paid_at: paid ? paidAt : null }, lines: { has_more: false, data: [{
            quantity: invoiceCount, amount: price.unit_amount * invoiceCount, currency: 'usd',
            pricing: { price_details: { price: price.id } }, period: { start: invoiceStart, end: invoiceEnd },
            parent: { subscription_item_details: { subscription, proration: false } },
          }] } }
      } },
    }
    const supabase = {
      from: table => { assert.equal(table, 'billing'); return { select() { return this }, eq(_, value) { assert.equal(value, site); return this },
        single: async () => ({ data: await one('SELECT stripe_customer_id,stripe_subscription_id FROM billing WHERE site_id=$1', [site]), error: null }) } },
      rpc: async (name, args) => {
        if (name === 'sync_stripe_subscription_state') {
          const keys = ['p_site_id','p_customer_id','p_subscription_id','p_expected_subscription_id','p_status',
            'p_current_period_end','p_start_date','p_end_date','p_auto_renew','p_invoice_id']
          return { data: (await one('SELECT sync_stripe_subscription_state($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
            keys.map(key => args[key] ?? null))).result, error: null }
        }
        assert.equal(name, 'settle_stripe_subscription_invoice')
        last = args.p_invoice
        return { data: (await one('SELECT settle_stripe_subscription_invoice($1::jsonb) result', [last])).result, error: null }
      },
    }
    const settle = () => settleStripeSubscriptionInvoice({ stripe, supabase, invoiceId, requirePaid: paid })
    const billing = () => one('SELECT * FROM billing WHERE site_id=$1', [site])
    await settle()
    let b = await billing()
    assert.equal(b.plan, 'commission'); assert.equal(b.addons_count, 2)
    assert.equal(Number(b.plan_credit_allowance), 3); assert.equal(Number(b.plan_credits_used), 0.75)
    assert.equal(Number(b.plan_credits_available), 2.25)
    assert.equal(Number(b.purchased_credits_available), 40); assert.equal(Number(b.legacy_credits_available), 7)
    assert.equal(Number(b.account_balance), 17.42)
    assert.equal((await settle()).credits_granted, 0)
    invoiceId = uid('in'); reason = 'subscription_update'; count = 3; invoiceCount = 3; paidAt++
    paid = false
    assert.equal((await settle()).outcome, 'failed_recorded')
    assert.equal((await billing()).addons_count, 2)
    paid = true
    await settle()
    b = await billing()
    assert.equal(b.addons_count, 3); assert.equal(Number(b.plan_credits_available), 3.25)
    assert.equal(Number(b.plan_credits_used), 0.75)
    assert.equal((await settle()).credits_granted, 0)
    // A delayed paid invoice with a different Free count cannot apply coverage.
    invoiceId = uid('in'); reason = 'subscription_update'; invoiceCount = 4; paidAt++
    assert.equal((await settle()).credits_granted, 0)
    assert.equal((await billing()).addons_count, 3)
    const mismatchState = await billing()
    const immutable = await one('SELECT verified_credit_coverage proof FROM stripe_subscription_invoice_settlements WHERE invoice_id=$1', [invoiceId])
    assert.equal((await settle()).credits_granted, 0)
    assert.equal(Number((await billing()).plan_credits_available), Number(mismatchState.plan_credits_available))
    count = 4
    assert.equal((await settle()).coverage_recovered, true)
    assert.equal((await billing()).addons_count, 4)
    assert.deepEqual(await one('SELECT verified_credit_coverage proof FROM stripe_subscription_invoice_settlements WHERE invoice_id=$1', [invoiceId]), immutable)
    assert.equal((await settle()).credits_granted, 0)
    invoiceCount = 3
    if (interval === 'year') {
      // Move the fixture to a real covered annual anniversary, representing time
      // passing without relying on PGlite's wall clock or a remote database.
      await db.query(`UPDATE billing SET plan_credit_anchor=now()-interval '1 month',
        paid_subscription_period_start=now()-interval '1 month',paid_subscription_period_end=now()+interval '11 months',
        plan_credit_period_start=now()-interval '1 month',plan_credit_period_end=now()-interval '1 second' WHERE site_id=$1`, [site])
      const renewed = (await one('SELECT renew_site_plan_credits($1) result', [site])).result
      assert.equal(renewed.outcome, 'reset'); assert.equal(renewed.credits_granted, 5)
      assert.equal(Number((await billing()).plan_credits_used), 0)
      // cancel_at_period_end retains verified annual service until terminal.
      await db.query('UPDATE billing SET auto_renew=false WHERE site_id=$1', [site])
      assert.equal((await one('SELECT renew_site_plan_credits($1) result', [site])).result.outcome, 'not_due')
    } else {
      // A new full monthly renewal can reduce extras and resets exactly 1+N;
      // worker renewal cannot manufacture unverified recurring coverage.
      await db.query(`UPDATE billing SET plan_credit_period_start=now()-interval '1 month',
        plan_credit_period_end=now()-interval '1 second',paid_subscription_period_start=now()-interval '1 month',
        paid_subscription_period_end=now()-interval '1 second' WHERE site_id=$1`, [site])
      assert.equal((await one('SELECT renew_site_plan_credits($1) result', [site])).result.credits_granted, 0)
      invoiceId = uid('in'); invoiceStart = now - 30; count = 1; invoiceCount = 1; paidAt++
      const renewalEnd = new Date(invoiceStart * 1000)
      renewalEnd.setUTCMonth(renewalEnd.getUTCMonth() + 1)
      invoiceEnd = renewalEnd.getTime() / 1000
      reason = 'subscription_cycle'
      assert.equal((await settle()).credits_granted, 2)
      assert.equal((await billing()).addons_count, 1)
      assert.equal(Number((await billing()).plan_credits_used), 0)
    }
    // Fresh authoritative terminal state clears add-ons; stale paid delivery
    // records money once but cannot restore coverage or credit extras.
    status = 'canceled'; invoiceId = uid('in'); reason = 'subscription_create'; paidAt++
    await settle()
    b = await billing()
    assert.equal(b.plan, 'commission'); assert.equal(b.addons_count, 0); assert.equal(b.paid_subscription_invoice_id, null)
    const used = Number(b.plan_credits_used)
    assert.equal((await one('SELECT renew_site_plan_credits($1) result', [site])).result.outcome, 'not_due')
    assert.equal(Number((await billing()).plan_credits_used), used)
    const replacement = uid('sub')
    await one('SELECT sync_stripe_subscription_state($1,$2,$3,$4,\'active\') result', [site, customer, replacement, subscription])
    assert.equal((await settle()).outcome, 'obsolete_subscription')
    assert.equal((await billing()).stripe_subscription_id, replacement)
    const obsolete = (await one('SELECT sync_stripe_subscription_state($1,$2,$3,$4,\'canceled\') result',
      [site, customer, subscription, replacement])).result
    assert.equal(obsolete.outcome, 'obsolete_subscription')
    // New replacement invoice retains the consumed paid window, not a reset.
    const replaceInput = { ...last, invoice_id: uid('in'), subscription_id: replacement,
      current_subscription_status: 'active', addons_count: 2, current_service: { plan: 'commission', addons_count: 2, billing_interval: interval },
      paid_at: iso(paidAt + 1) }
    await one('SELECT settle_stripe_subscription_invoice($1::jsonb) result', [replaceInput])
    assert.equal(Number((await billing()).plan_credits_used), used)
    const protectedState = await billing()
    for (const bad of [{ addons_count: 0 }, { coverage_verified: false }, { customer_id: uid('cus') }, { site_id: randomUUID() }]) {
      await assert.rejects(one('SELECT settle_stripe_subscription_invoice($1::jsonb) result', [{ ...replaceInput, invoice_id: uid('in'), ...bad }]))
    }
    await db.exec(`CREATE FUNCTION reject_free_credit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected credit failure'; END; $$;
      CREATE TRIGGER reject_free_credit BEFORE INSERT ON credit_transactions FOR EACH ROW EXECUTE FUNCTION reject_free_credit();`)
    await assert.rejects(one('SELECT settle_stripe_subscription_invoice($1::jsonb) result', [{ ...replaceInput,
      invoice_id: uid('in'), billing_reason: 'subscription_update', addons_count: 3,
      current_service: { plan: 'commission', addons_count: 3, billing_interval: interval }, paid_at: iso(paidAt + 2) }]), /Injected credit failure/)
    await db.exec('DROP TRIGGER reject_free_credit ON credit_transactions; DROP FUNCTION reject_free_credit();')
    assert.deepEqual(await billing(), protectedState)
  }
  console.log('PASS Free monthly and annual producer + SQL settlement')
  console.log('PASS Free cancellation, replacement and renewal chronology')
  console.log('PASS Free SQL tenant, privilege, proof and atomic failure fences')
}
main().then(() => db.close()).catch(async error => { console.error(error); await db.close(); process.exitCode = 1 })