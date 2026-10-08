import { billingService } from '@/app/services/billing-service'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/services/api-client-service', () => ({ isDemoModeActive: jest.fn(async () => false) }))

describe('subscription checkout frontend contract', () => {
  beforeEach(() => { global.fetch = jest.fn() })

  it('defaults fifth argument to month and preserves sessionId', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ url: 'https://checkout.example.test/session', sessionId: 'session-example' }) } as Response)
    const result = await billingService.createSubscriptionCheckoutSession('site-example', 'engine', 'user@example.test', 2)
    const body = JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ plan: 'engine', addonsCount: 2, billingInterval: 'month' })
    expect(body).not.toHaveProperty('amount')
    expect(result).toEqual({ success: true, url: 'https://checkout.example.test/session', sessionId: 'session-example' })
  })

  it('posts annual interval and accepts an existing-subscription hosted portal URL', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ url: 'https://portal.example.test/confirm' }) } as Response)
    const result = await billingService.createSubscriptionCheckoutSession('site-example', 'foundry', 'user@example.test', 0, 'year')
    expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string).billingInterval).toBe('year')
    expect(result.success).toBe(true)
    expect(result.url).toBe('https://portal.example.test/confirm')
  })

  it.each([
    [false, { error: 'Use billing support for subscriptions with add-ons' }],
    [true, {}],
  ])('does not report a working checkout without a successful URL', async (ok, body) => {
    jest.mocked(fetch).mockResolvedValue({ ok, json: async () => body } as Response)
    const result = await billingService.createSubscriptionCheckoutSession('site-example', 'engine', 'user@example.test', 0, 'year')
    expect(result.success).toBe(false)
    expect(result.url).toBeUndefined()
    expect(result.error).toBeTruthy()
  })
})