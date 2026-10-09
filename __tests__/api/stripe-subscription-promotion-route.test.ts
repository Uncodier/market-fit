/** @jest-environment node */
import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/stripe/subscription/promotion/route'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { createServiceApiClient } from '@/lib/supabase/server-client'
import { applySubscriptionPromotion } from '@/app/api/stripe/subscription/promotion/discounts'

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/lib/auth/api-stripe-access', () => ({ requireStripeSiteAccess: jest.fn() }))
jest.mock('@/lib/supabase/server-client', () => ({ createServiceApiClient: jest.fn() }))
jest.mock('@/app/api/stripe/subscription/promotion/discounts', () => ({ applySubscriptionPromotion: jest.fn() }))
const siteId = 'eb809a41-c931-450c-9e6d-8578c837b504'
const rpc = jest.fn()
const sdk = { customers: { retrieve: jest.fn() }, subscriptions: { retrieve: jest.fn(), list: jest.fn() },
  invoices: { retrieve: jest.fn() } }
const sub = { id: 'sub_test', customer: 'cus_test', status: 'active', items: {
  has_more: false, data: [{ quantity: 1, price: { id: 'price_engine', unit_amount: 2300, currency: 'usd',
    type: 'recurring', billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } } }] } }
function request(body: unknown = { siteId, code: 'SAVE20' }) {
  return new NextRequest('https://example.test/api/stripe/subscription/promotion', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.test' }, body: JSON.stringify(body) })
}
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_promotion'
  process.env.STRIPE_STARTER_PRICE_ID = 'price_engine'
  jest.mocked(Stripe).mockImplementation(() => sdk as unknown as Stripe)
  jest.mocked(requireStripeSiteAccess).mockResolvedValue({ userId: 'user_test', role: 'owner',
    supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { stripe_customer_id: 'cus_test', stripe_subscription_id: 'sub_test' }, error: null,
    }) }) }) }) } } as never)
  jest.mocked(createServiceApiClient).mockReturnValue({ rpc } as never)
  rpc.mockImplementation(async name => ({ data: name === 'claim_site_subscription_checkout'
    ? { state: 'claimed', token: 'lease_test' } : true, error: null }))
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_test', metadata: { site_id: siteId } })
  sdk.subscriptions.retrieve.mockResolvedValue(sub)
  sdk.subscriptions.list.mockResolvedValue({ data: [sub], has_more: false })
  jest.mocked(applySubscriptionPromotion).mockResolvedValue({ success: true, alreadyApplied: false })
})
afterAll(() => { delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_STARTER_PRICE_ID })
it('accepts a verified Free add-on-only subscription, not duplicate or empty items', async () => {
  process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = 'price_extra'
  try {
    const extra = { quantity: 2, price: { ...sub.items.data[0].price, id: 'price_extra', unit_amount: 1000 } }
    const free = { ...sub, items: { has_more: false, data: [extra] } }
    sdk.subscriptions.retrieve.mockResolvedValue(free)
    expect((await POST(request())).status).toBe(200)
    for (const data of [[], [extra, extra], [{ ...extra, quantity: 101 }]]) {
      sdk.subscriptions.retrieve.mockResolvedValue({ ...free, items: { has_more: false, data } })
      expect((await POST(request())).status).toBe(409)
    }
    expect(applySubscriptionPromotion).toHaveBeenCalledTimes(1)
  } finally { delete process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID }
})
it('applies an authorized discount under the same billing lease', async () => {
  expect((await POST(request())).status).toBe(200)
  expect(applySubscriptionPromotion).toHaveBeenCalledWith(expect.objectContaining({ code: 'SAVE20', sub }))
  expect(rpc).toHaveBeenCalledWith('finish_site_subscription_checkout', { p_site_id: siteId, p_token: 'lease_test' })
})
it.each([401, 403])('denies unauthenticated or cross-tenant requests (%s)', async status => {
  jest.mocked(requireStripeSiteAccess).mockResolvedValueOnce({ error: NextResponse.json({}, { status }) } as never)
  expect((await POST(request())).status).toBe(status)
  expect(createServiceApiClient).not.toHaveBeenCalled()
  expect(Stripe).not.toHaveBeenCalled()
})
it('rejects a foreign origin before authentication or Stripe access', async () => {
  const req = request()
  req.headers.set('origin', 'https://attacker.example.test')
  expect((await POST(req)).status).toBe(403)
  expect(requireStripeSiteAccess).not.toHaveBeenCalled()
})
it.each([null, [], { siteId, code: '' }, { siteId: 'foreign', code: 'SAVE20' }, { siteId, code: 'x'.repeat(101) }])(
  'rejects malformed input %#', async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(Stripe).not.toHaveBeenCalled()
  })
it.each([{ pending_update: {} }, { schedule: 'sched_test' }, { customer: 'cus_other' }, { status: 'past_due' }])(
  'rejects uncertain subscription state %#', async override => {
    sdk.subscriptions.retrieve.mockResolvedValueOnce({ ...sub, ...override })
    expect((await POST(request())).status).toBe(409)
    expect(applySubscriptionPromotion).not.toHaveBeenCalled()
  })
it('retains the lease after an ambiguous provider write', async () => {
  jest.mocked(applySubscriptionPromotion).mockImplementationOnce(async input => {
    input.beforeProviderWrite()
    throw new Error('Provider timeout')
  })
  expect((await POST(request())).status).toBe(503)
  expect(rpc).not.toHaveBeenCalledWith('finish_site_subscription_checkout', expect.anything())
})

it.each(['open', 'draft', 'void'])('rejects %s latest invoices before changing discounts', async status => {
  sdk.subscriptions.retrieve.mockResolvedValueOnce({ ...sub, latest_invoice: 'in_current' })
  sdk.invoices.retrieve.mockResolvedValueOnce({ id: 'in_current', customer: 'cus_test', subscription: 'sub_test', status })
  expect((await POST(request())).status).toBe(409)
  expect(applySubscriptionPromotion).not.toHaveBeenCalled()
})

it('accepts a verified paid latest invoice', async () => {
  sdk.subscriptions.retrieve.mockResolvedValueOnce({ ...sub, latest_invoice: 'in_current' })
  sdk.invoices.retrieve.mockResolvedValueOnce({ id: 'in_current', customer: 'cus_test', subscription: 'sub_test', status: 'paid' })
  expect((await POST(request())).status).toBe(200)
})