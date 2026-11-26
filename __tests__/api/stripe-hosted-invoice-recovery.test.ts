/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { licensePostgresAvailable, licenseUuid } from '../security/site-license-postgres'
import { startupTrialPostgres, startupTrialPrerequisitesAvailable } from '../security/startup-trial-postgres'

const mockStripeFetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const mockCreateServiceClient = jest.fn()

jest.mock('stripe', () => {
  const SDK = jest.requireActual<typeof Stripe>('stripe')
  return { __esModule: true, default: class extends SDK {
    constructor(key: string, options: Stripe.StripeConfig) {
      super(key, { ...options, httpClient: SDK.createFetchHttpClient(mockStripeFetch), maxNetworkRetries: 0 })
    }
  } }
})
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: mockCreateServiceClient }))

const suite = licensePostgresAvailable && startupTrialPrerequisitesAvailable ? describe : describe.skip
const migration = (name: string) => readFileSync(path.resolve(__dirname, '../../supabase/migrations', name), 'utf8')
const endpointSecret = 'whsec_hosted_invoice_offline'
const apiVersion = '2025-05-28.basil'
const priceId = 'price_HostedFoundryMonth'
const iso = (seconds: number) => new Date(seconds * 1000).toISOString()
const literal = (value: unknown) => value == null ? 'NULL' : typeof value === 'boolean' ? String(value) :
  `'${(typeof value === 'string' ? value : JSON.stringify(value)).replace(/'/g, "''")}'`

const rpcNames = new Set([
  'claim_stripe_webhook_event', 'complete_stripe_webhook_event', 'fail_stripe_webhook_event',
  'sync_stripe_subscription_state', 'settle_stripe_subscription_invoice', 'record_stripe_late_renewal_access',
])

function postgresClient(pg: ReturnType<typeof startupTrialPostgres>) {
  // Thin adapter only: never simulates a settlement result or writes fixture state for the webhook.
  const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
    if (!rpcNames.has(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) {
      throw new Error(`Unexpected database RPC: ${name}`)
    }
    const named = Object.entries(args).map(([key, value]) => `${key} => ${literal(value)}`).join(', ')
    const data = JSON.parse(pg.call(`SELECT to_jsonb(public.${name}(${named}));`, undefined, 'service_role'))
    return { data, error: null }
  })
  const from = (table: string) => ({ select: (columns: string) => ({ eq: (key: string, site: string) => ({
    single: async () => {
      if (table !== 'billing' || columns !== 'stripe_customer_id,stripe_subscription_id' || key !== 'site_id') {
        throw new Error('Unexpected billing lookup')
      }
      const row = pg.call(`SELECT row_to_json(b) FROM (SELECT stripe_customer_id, stripe_subscription_id
        FROM billing WHERE site_id=${literal(site)}) b;`, undefined, 'service_role')
      return { data: row ? JSON.parse(row) : null, error: null }
    },
  }) }) })
  return { rpc, from }
}

function hostedProvider(site: string, suffix: number) {
  const invoiceId = `in_hosted${suffix}`, subscriptionId = `sub_hosted${suffix}`, customerId = `cus_hosted${suffix}`
  const intentId = `pi_hosted${suffix}`, chargeId = `ch_hosted${suffix}`
  const paidAt = Math.floor(Date.now() / 1000) - 60
  const start = paidAt - 3 * 86400
  const endDate = new Date(start * 1000)
  const anchor = endDate.getUTCDate()
  endDate.setUTCDate(1)
  endDate.setUTCMonth(endDate.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 0)).getUTCDate()
  endDate.setUTCDate(Math.min(anchor, lastDay))
  const end = endDate.getTime() / 1000
  const endedAt = paidAt - 3600
  const amount = 9900
  const hostedUrl = `https://invoice.stripe.com/i/test_hosted${suffix}`
  const price = { id: priceId, currency: 'usd', active: true, type: 'recurring', billing_scheme: 'per_unit',
    unit_amount: amount, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } }
  const invoice = {
    id: invoiceId, object: 'invoice', customer: customerId, livemode: false, status: 'open',
    currency: 'usd', billing_reason: 'subscription_cycle', hosted_invoice_url: hostedUrl,
    amount_paid: 0, amount_due: amount, amount_remaining: amount, total: amount,
    pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0,
    status_transitions: { paid_at: null as number | null },
    parent: { subscription_details: { subscription: subscriptionId } },
    lines: { has_more: false, data: [{ id: `il_hosted${suffix}`, amount, currency: 'usd', quantity: 1,
      discountable: true, period: { start, end },
      parent: { subscription_item_details: { subscription: subscriptionId, proration: false } },
      pricing: { price_details: { price: priceId }, unit_amount_decimal: String(amount) } }] },
    payments: { has_more: false, data: [{ invoice: invoiceId, payment: { type: 'payment_intent', payment_intent: intentId },
      status: 'open', amount_paid: 0, currency: 'usd', livemode: false }] },
  }
  const subscription = {
    id: subscriptionId, object: 'subscription', customer: customerId, livemode: false, status: 'past_due',
    start_date: start - 86400, ended_at: null as number | null, cancel_at: null, cancel_at_period_end: false,
    cancellation_details: null as { reason: string } | null, latest_invoice: invoiceId,
    items: { has_more: false, data: [{ price, quantity: 1, current_period_end: end }] },
  }
  const intent = {
    id: intentId, customer: customerId, status: 'succeeded', amount_received: amount, currency: 'usd', livemode: false,
    latest_charge: { id: chargeId, payment_intent: intentId, customer: customerId, livemode: false,
      amount, amount_captured: amount, currency: 'usd', status: 'succeeded', paid: true, captured: true,
      disputed: false, refunded: false, amount_refunded: 0 },
  }
  const reads: Record<string, object> = {
    [`/v1/invoices/${invoiceId}`]: invoice, [`/v1/subscriptions/${subscriptionId}`]: subscription,
    [`/v1/customers/${customerId}`]: { id: customerId, metadata: { site_id: site } },
    [`/v1/prices/${priceId}`]: price, [`/v1/payment_intents/${intentId}`]: intent,
  }
  const unexpected: string[] = []
  mockStripeFetch.mockReset().mockImplementation(async (input, init) => {
    const url = new URL(String(input))
    const method = init?.method?.toUpperCase()
    const body = url.origin === 'https://api.stripe.com' && method === 'GET' ? reads[url.pathname] : undefined
    if (!body) {
      unexpected.push(`${method} ${url.pathname}`)
      throw new Error(`Unexpected Stripe request: ${unexpected.at(-1)}`)
    }
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  })
  const pay = () => {
    Object.assign(invoice, { status: 'paid', amount_paid: amount, amount_remaining: 0, status_transitions: { paid_at: paidAt } })
    Object.assign(invoice.payments.data[0], { status: 'paid', amount_paid: amount })
  }
  return { invoiceId, subscriptionId, customerId, chargeId, subscription, hostedUrl, paidAt, endedAt, end, pay, unexpected }
}

suite('hosted overdue invoice recovery without a UI callback', () => {
  const pg = startupTrialPostgres()
  const stripeEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('STRIPE_')))
  const clearStripeEnv = () => {
    for (const key of Object.keys(process.env)) if (key.startsWith('STRIPE_')) delete process.env[key]
  }
  let post: typeof import('@/app/api/stripe/webhook/route').POST
  let signer: Stripe

  beforeAll(async () => {
    clearStripeEnv()
    Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_hosted_invoice_offline',
      STRIPE_WEBHOOK_SECRET: endpointSecret, STRIPE_STARTUP_PRICE_ID: priceId })
    post = (await import('@/app/api/stripe/webhook/route')).POST
    signer = new Stripe('sk_test_signer_offline')
    pg.start()
    pg.install()
    pg.db(`CREATE TABLE webhook_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stripe_event_id text NOT NULL,
      event_type text NOT NULL, processed_at timestamptz, status text NOT NULL, event_data jsonb, error_message text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());`)
    for (const name of ['20260917210100_stripe_webhook_delivery_claims.sql',
      '20260925000000_fix_webhook_events_status_constraint.sql', '20261020002000_manual_agent_channel_activation.sql',
      '20261021001000_reconcile_paid_coverage_licenses.sql', '20261125200000_stripe_late_renewal_access.sql',
      '20261125213000_individual_late_payment_access_month.sql', '20261125220000_automatic_late_payment_access_month.sql']) {
      pg.db(migration(name))
    }
  }, 60000)

  afterAll(() => {
    clearStripeEnv()
    Object.assign(process.env, stripeEnv)
    pg.stop()
  })

  it.each([
    [801, 'active', 'invoice.paid', 'invoice.payment_succeeded'],
    [802, 'active', 'invoice.payment_succeeded', 'invoice.paid'],
    [803, 'canceled', 'invoice.paid', 'invoice.payment_succeeded'],
    [804, 'canceled', 'invoice.payment_succeeded', 'invoice.paid'],
  ] as const)('settles fixture %i into %s on %s and deduplicates %s', async (n, status, paidType, alternateType) => {
    const { site } = pg.seed(n)
    const provider = hostedProvider(site, n)
    const { invoiceId, customerId, subscriptionId } = provider
    const terminal = status === 'canceled'
    const member = licenseUuid(n + 3000)
    const { rpc, from } = postgresClient(pg)
    mockCreateServiceClient.mockReset().mockResolvedValue({ rpc, from })
    pg.db(`UPDATE billing SET plan='foundry' WHERE site_id=${literal(site)};
      INSERT INTO site_members(site_id,user_id,role,status,email,created_at) VALUES
      (${literal(site)},${literal(member)},'admin','active','member@example.test',to_timestamp(${provider.endedAt - 60}));
      UPDATE billing SET stripe_customer_id=${literal(customerId)},stripe_subscription_id=${literal(subscriptionId)},
      subscription_status='past_due' WHERE site_id=${literal(site)};`)
    const accessibleSites = () => pg.call('SELECT id FROM get_my_accessible_sites() ORDER BY id;', member)
    // Lifecycle sync can touch updated_at without changing any billing values.
    const state = () => JSON.parse(pg.db(`SELECT jsonb_build_object(
      'billing',(SELECT to_jsonb(x) - 'updated_at' FROM billing x WHERE site_id=${literal(site)}),
      'payments',ARRAY(SELECT to_jsonb(x) FROM payments x WHERE site_id=${literal(site)} ORDER BY id),
      'ledger',ARRAY(SELECT to_jsonb(x) FROM credit_transactions x WHERE site_id=${literal(site)} ORDER BY id),
      'markers',ARRAY(SELECT to_jsonb(x) FROM stripe_subscription_invoice_settlements x WHERE site_id=${literal(site)} ORDER BY invoice_id),
      'access',ARRAY(SELECT to_jsonb(x) FROM stripe_late_renewal_access x WHERE site_id=${literal(site)} ORDER BY invoice_id),
      'extensions',ARRAY(SELECT to_jsonb(x) FROM late_payment_access_months x WHERE invoice_id=${literal(invoiceId)}));`))
    const deliver = async (type: string, suffix: string, object: object) => {
      const id = `evt_hosted${n}${suffix}`
      const payload = JSON.stringify({ id, object: 'event', type, api_version: apiVersion,
        created: Math.floor(Date.now() / 1000), livemode: false, data: { object } })
      const headers = { 'stripe-signature': signer.webhooks.generateTestHeaderString({ payload, secret: endpointSecret }) }
      const response = await post(new NextRequest('https://app.example.test/api/stripe/webhook', { method: 'POST', headers, body: payload }))
      const body = await response.json()
      expect({ status: response.status, body }).toMatchObject({ status: 200, body: { received: true, eventId: id } })
      return body
    }

    const invoiceRef = { id: invoiceId, object: 'invoice' }
    await deliver('invoice.payment_failed', 'Failed', invoiceRef)
    const failed = state()
    const transactionId = `stripe_invoice_${invoiceId}`
    const failedPayment = failed.payments.find((p: { transaction_id: string }) => p.transaction_id === transactionId)
    expect(failed).toMatchObject({ billing: { subscription_status: 'past_due' }, markers: [], access: [], extensions: [] })
    expect(failedPayment).toMatchObject({ status: 'failed', invoice_url: provider.hostedUrl, credits: 0 })
    if (terminal) {
      Object.assign(provider.subscription, { status: 'canceled', ended_at: provider.endedAt,
        cancellation_details: { reason: 'payment_failed' } })
      await deliver('customer.subscription.deleted', 'Canceled', { id: subscriptionId, object: 'subscription' })
    } else {
      provider.subscription.status = 'active'
    }
    const overdue = state()
    expect(overdue.billing.subscription_status).toBe(terminal ? 'canceled' : 'past_due')
    if (terminal) expect(accessibleSites()).toBe('')

    // This is the entire simulated payment action: Stripe changes its snapshots
    // and sends an invoice event. No Checkout Session, redirect, or billing UI.
    provider.pay()
    const staleEventObject = { ...invoiceRef, status: 'open' }
    await deliver(paidType, 'Paid', staleEventObject)
    const paid = state()
    const credits = terminal ? 0 : 100
    expect(paid.billing).toMatchObject({ stripe_customer_id: customerId, stripe_subscription_id: subscriptionId,
      subscription_status: status, auto_renew: !terminal, plan: terminal ? 'commission' : 'foundry',
      plan_credits_available: terminal ? overdue.billing.plan_credits_available : credits,
      purchased_credits_available: 40, legacy_credits_available: 7,
      account_balance: 17.42, paid_subscription_invoice_id: terminal ? null : invoiceId })
    expect(paid.payments).toEqual(overdue.payments.map((p: { id: string }) => p.id === failedPayment.id ?
      expect.objectContaining({ id: p.id, transaction_id: transactionId, status: 'completed', amount: 99,
        currency: 'USD', credits, invoice_url: provider.hostedUrl, details: expect.objectContaining({ paid_at: iso(provider.paidAt) }) }) : p))
    expect(paid.markers).toHaveLength(1)
    expect(paid.markers[0]).toMatchObject({ invoice_id: invoiceId, subscription_id: subscriptionId,
      payment_id: failedPayment.id, credits_granted: credits, credit_coverage_applied: !terminal })
    expect(accessibleSites()).toBe(site)
    if (terminal) {
      expect(paid.billing).toEqual(overdue.billing)
      expect(paid.ledger).toEqual(overdue.ledger)
      expect(paid.access).toHaveLength(1)
      expect(paid.access[0]).toMatchObject({ invoice_id: invoiceId, subscription_id: subscriptionId, charge_id: provider.chargeId })
      expect(paid.extensions).toHaveLength(1)
      expect(pg.db(`SELECT stripe_late_renewal_paid_through(${literal(site)},${literal(customerId)},${literal(subscriptionId)})
        = greatest(to_timestamp(${provider.end}), ((to_timestamp(${provider.paidAt}) AT TIME ZONE 'UTC')
          + interval '1 month') AT TIME ZONE 'UTC');`)).toBe('t')
    } else {
      expect(paid.ledger).toHaveLength(overdue.ledger.length + 1)
      expect(paid.access).toEqual([])
      expect(paid.extensions).toEqual([])
    }

    const reads = mockStripeFetch.mock.calls.length
    expect(await deliver(paidType, 'Paid', staleEventObject)).toMatchObject({ message: 'Event already processed' })
    expect(mockStripeFetch).toHaveBeenCalledTimes(reads)
    expect(state()).toEqual(paid)

    const rpcCalls = rpc.mock.calls.length
    await deliver(alternateType, 'Alternate', staleEventObject)
    expect(rpc.mock.calls.slice(rpcCalls).map(([name]) => name)).toEqual([
      'claim_stripe_webhook_event', 'sync_stripe_subscription_state', 'settle_stripe_subscription_invoice',
      ...(terminal ? ['record_stripe_late_renewal_access'] : []), 'complete_stripe_webhook_event',
    ])
    expect(state()).toEqual(paid)
    expect(accessibleSites()).toBe(site)
    expect(provider.unexpected).toEqual([])
  }, 20000)
})