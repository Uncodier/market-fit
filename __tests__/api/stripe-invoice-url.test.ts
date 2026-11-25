/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'

const mockRetrieve = jest.fn()
jest.mock('stripe', () => jest.fn(() => ({ invoices: { retrieve: mockRetrieve } })))
jest.mock('@/lib/auth/api-stripe-access', () => ({ requireStripeSiteAccess: jest.fn() }))

const siteId = '11111111-1111-4111-8111-111111111111'
const paymentId = '22222222-2222-4222-8222-222222222222'
const invoiceId = 'in_synthetic'
const hostedUrl = 'https://invoice.stripe.com/i/synthetic'
const invoice = { id: invoiceId, customer: 'cus_site', status: 'open', amount_remaining: 9900, hosted_invoice_url: hostedUrl }
const payment = { status: 'failed', details: { stripe_invoice_id: invoiceId } }
const payments = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const billing = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const from = jest.fn((table: string) => table === 'payments' ? payments : billing)
let post: typeof import('@/app/api/stripe/invoice-url/route').POST

beforeAll(async () => {
  const original = process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic'
  try {
    post = (await import('@/app/api/stripe/invoice-url/route')).POST
  } finally {
    if (original === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = original
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireStripeSiteAccess).mockResolvedValue({ supabase: { from } } as never)
  payments.maybeSingle.mockResolvedValue({ data: payment, error: null })
  billing.maybeSingle.mockResolvedValue({ data: { stripe_customer_id: invoice.customer }, error: null })
  mockRetrieve.mockResolvedValue(invoice)
})

function pay(body: Record<string, unknown> = { purpose: 'pay', siteId, paymentId }) {
  return post(new NextRequest('https://app.example.test/api/stripe/invoice-url', {
    method: 'POST', body: JSON.stringify(body),
  }))
}

it('returns only the verified hosted URL for the selected site payment', async () => {
  const response = await pay({ purpose: 'pay', siteId, paymentId, stripe_invoice_id: 'in_ignored' })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ url: hostedUrl })
  expect(payments.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(payments.eq).toHaveBeenCalledWith('id', paymentId)
  expect(billing.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(mockRetrieve).toHaveBeenCalledWith(invoiceId)
})

it('rejects malformed, unauthorized and out-of-scope requests before calling Stripe', async () => {
  expect((await pay({ purpose: 'pay', siteId, stripe_invoice_id: invoiceId })).status).toBe(400)
  expect(requireStripeSiteAccess).not.toHaveBeenCalled()
  jest.mocked(requireStripeSiteAccess).mockResolvedValueOnce({ error: new NextResponse(null, { status: 403 }) })
  expect((await pay()).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
  payments.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect((await pay()).status).toBe(404)
  payments.maybeSingle.mockResolvedValueOnce({ data: { ...payment, status: 'completed' }, error: null })
  expect((await pay()).status).toBe(409)
  expect(mockRetrieve).not.toHaveBeenCalled()
})

it.each([
  { status: 'paid' }, { status: 'void' }, { status: 'draft' }, { status: 'uncollectible' },
  { amount_remaining: 0 }, { customer: 'cus_other' }, { id: 'in_other' },
  { hosted_invoice_url: null }, { hosted_invoice_url: 'https://example.test/invoice' },
  { hosted_invoice_url: 'https://user@invoice.stripe.com/i/synthetic' },
])('does not offer payment when Stripe reports %j', async (field) => {
  mockRetrieve.mockResolvedValueOnce({ ...invoice, ...field, invoice_pdf: 'https://example.test/invoice.pdf' })
  const response = await pay()
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: 'Invoice is not payable' })
})

it('preserves PDF fallback for the existing download request', async () => {
  const pdf = 'https://example.test/invoice.pdf'
  mockRetrieve.mockResolvedValueOnce({ ...invoice, status: 'paid', hosted_invoice_url: null, invoice_pdf: pdf })
  const response = await pay({ siteId, stripe_invoice_id: invoiceId })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ url: pdf })
})