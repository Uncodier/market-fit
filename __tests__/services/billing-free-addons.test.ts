import { billingService } from '@/app/services/billing-service'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/services/api-client-service', () => ({ isDemoModeActive: async () => false }))

beforeEach(() => jest.clearAllMocks())
afterEach(() => jest.restoreAllMocks())

it.each(['month', 'year'] as const)('requests only the free plan add-on quantity and %s interval', async billingInterval => {
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true,
    json: async () => ({ url: 'https://checkout.stripe.com/c/pay/addons', sessionId: 'cs_addons' }),
  } as Response)
  expect(await billingService.createSubscriptionCheckoutSession('site-example', 'commission', 'user@example.test', 2, billingInterval))
    .toMatchObject({ success: true, sessionId: 'cs_addons' })
  const [url, request] = fetch.mock.calls[0]
  expect(url).toBe('/api/stripe/checkout/subscription')
  expect(JSON.parse(request!.body as string)).toEqual({
    siteId: 'site-example', plan: 'commission', userEmail: 'user@example.test', addonsCount: 2, billingInterval,
    successUrl: `${window.location.origin}/billing/success?plan=commission`,
    cancelUrl: `${window.location.origin}/billing#addons`,
  })
})

it('accepts confirmed renewal cancellation for free without fabricating an immediate change', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
    flow: 'scheduled_addon_reduction', effectiveAt: '2026-11-08T00:00:00Z',
  }) } as Response)
  expect(await billingService.createSubscriptionCheckoutSession('site-example', 'commission', 'user@example.test', 0))
    .toMatchObject({ success: true, flow: 'scheduled_addon_reduction', effectiveAt: '2026-11-08T00:00:00Z' })
})

it('does not report an unverified free add-on response as success', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ flow: 'scheduled_addon_reduction' }) } as Response)
  expect(await billingService.createSubscriptionCheckoutSession('site-example', 'commission', 'user@example.test', 0))
    .toMatchObject({ success: false })
})