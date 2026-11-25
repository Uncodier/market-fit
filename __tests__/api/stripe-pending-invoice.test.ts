/** @jest-environment node */
import { NextResponse } from 'next/server'
import { GET } from '@/app/api/stripe/pending-invoice/route'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'

const mockRetrieve = jest.fn()
const mockList = jest.fn()
jest.mock('stripe', () => jest.fn(() => ({
  customers: { retrieve: mockRetrieve }, invoices: { list: mockList },
})))
jest.mock('@/lib/auth/api-stripe-access', () => ({ requireStripeSiteAccess: jest.fn() }))

const siteId = '11111111-1111-4111-8111-111111111111'
const customerId = 'cus_synthetic'
const request = (id = siteId) => new Request(`https://app.example.test/api/stripe/pending-invoice?siteId=${id}`)
const mockBilling = jest.fn()
const eq = jest.fn(() => ({ maybeSingle: mockBilling }))
const from = jest.fn(() => ({ select: () => ({ eq }) }))
const access = { role: 'owner', supabase: { from }, userId: 'owner', userEmail: null }
const originalKey = process.env.STRIPE_SECRET_KEY

beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic'
  jest.mocked(requireStripeSiteAccess).mockResolvedValue(access)
  mockBilling.mockResolvedValue({ data: { stripe_customer_id: customerId }, error: null })
  mockRetrieve.mockResolvedValue({ id: customerId, metadata: { site_id: siteId } })
  mockList.mockReturnValue([])
})

afterEach(() => {
  if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = originalKey
})

it('validates the site and rejects anonymous callers and non-owners before looking up billing', async () => {
  expect((await GET(request('invalid'))).status).toBe(400)
  expect(requireStripeSiteAccess).not.toHaveBeenCalled()
  jest.mocked(requireStripeSiteAccess).mockResolvedValueOnce({ error: new NextResponse(null, { status: 401 }) })
  expect((await GET(request())).status).toBe(401)
  jest.mocked(requireStripeSiteAccess).mockResolvedValueOnce({ ...access, role: 'admin' })
  expect((await GET(request())).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
  expect(mockRetrieve).not.toHaveBeenCalled()
})

it('returns only a private boolean when any open invoice has a remaining balance', async () => {
  mockList.mockReturnValue([{ status: 'open', amount_remaining: 0 }, { status: 'open', amount_remaining: 200 }])
  const response = await GET(request())
  expect(eq).toHaveBeenCalledWith('site_id', siteId)
  expect(mockList).toHaveBeenCalledWith({ customer: customerId, status: 'open', limit: 100 })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ hasPendingInvoice: true })
})

it('does not count paid, void, draft or zero-balance invoices', async () => {
  mockList.mockReturnValue([{ status: 'open', amount_remaining: 0 },
    ...['paid', 'void', 'draft', 'uncollectible'].map(status => ({ status, amount_remaining: 100 }))])
  expect(await (await GET(request())).json()).toEqual({ hasPendingInvoice: false })
})

it('skips Stripe without a billing customer and fails closed if the customer belongs to another site', async () => {
  mockBilling.mockResolvedValueOnce({ data: null, error: null })
  expect(await (await GET(request())).json()).toEqual({ hasPendingInvoice: false })
  expect(mockRetrieve).not.toHaveBeenCalled()
  mockRetrieve.mockResolvedValueOnce({ id: customerId, metadata: { site_id: 'other-site' } })
  expect((await GET(request())).status).toBe(503)
  expect(mockList).not.toHaveBeenCalled()
})