/** @jest-environment node */
import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { GET as credits } from '@/app/api/onboarding/check-credits/route'
import { GET as billing } from '@/app/api/onboarding/check-billing/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { lookupCurrentUserSiteRole } from '@/lib/auth/site-role-lookup'
import { canAccessUnscopedSite } from '@/lib/permissions/location-boundary'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/lib/auth/site-role-lookup', () => ({
  lookupCurrentUserSiteRole: jest.fn(), SiteRoleLookupError: class extends Error {},
}))
jest.mock('@/lib/permissions/location-boundary', () => ({ canAccessUnscopedSite: jest.fn() }))
jest.mock('@/lib/permissions/location-access', () => ({ userCanOnLocation: jest.fn() }))

const siteId = '11111111-1111-4111-8111-111111111111'
const query = { select: jest.fn(), eq: jest.fn(), single: jest.fn() }
const from = jest.fn()
const getUser = jest.fn()

function request(authenticated = true, site = siteId) {
  const url = new URL('https://app.example.test/api/onboarding/check-credits')
  url.searchParams.set('siteId', site)
  return new NextRequest(url, { headers: authenticated ? {
    authorization: `Bearer ${randomBytes(32).toString('hex')}`,
  } : {} })
}

beforeEach(() => {
  jest.resetAllMocks()
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.single.mockResolvedValue({ data: { plan: 'free', status: 'inactive', credits_available: 0, account_balance: 3 }, error: null })
  from.mockReturnValue(query)
  getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, from } as never)
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue('owner')
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(true)
})

describe.each([['credits', credits], ['billing', billing]] as const)('%s onboarding admission', (kind, handler) => {
  it.each([[0, 3, true], [0.4, 0.6, true], [2, null, true], [0, null, false], [2, -3, false], [2, -2, false]])(
    'uses regular %s + wallet %s', async (regular, wallet, admitted) => {
      query.single.mockResolvedValue({ data: { plan: 'free', status: 'inactive', credits_available: regular, account_balance: wallet }, error: null })
      const response = await handler(request())
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(await response.json()).toMatchObject(kind === 'credits'
        ? { hasCredits: admitted, credits_available: regular, spendable_credits: regular + (wallet ?? 0) }
        : { hasBillingSetup: admitted })
      expect(query.select).toHaveBeenCalledWith(expect.stringContaining('account_balance'))
      expect(query.eq).toHaveBeenCalledWith('site_id', siteId)
      expect(createServiceClient).not.toHaveBeenCalled()
      expect(jest.mocked(canAccessUnscopedSite).mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0])
    },
  )

  it.each([NaN, Infinity, -Infinity, '5', true, undefined])('fails closed on invalid wallet %p', async value => {
    query.single.mockResolvedValue({ data: { plan: 'engine', status: 'active', credits_available: 10, account_balance: value }, error: null })
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(await response.json()).not.toHaveProperty(kind === 'credits' ? 'hasCredits' : 'hasBillingSetup')
  })

  it.each(['missing', 'error', 'throw'])('fails closed on %s billing', async mode => {
    if (mode === 'throw') query.single.mockRejectedValue(new Error('private database error'))
    else query.single.mockResolvedValue({ data: null, error: mode === 'error' ? { message: 'private database error' } : null })
    const response = await handler(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private database error')
  })

  it.each(['anonymous', 'invalid-session', 'foreign-site', 'restricted-location'])('denies %s before reading billing', async mode => {
    if (mode === 'invalid-session') getUser.mockResolvedValue({ data: { user: null }, error: null })
    if (mode === 'foreign-site') jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(null)
    if (mode === 'restricted-location') jest.mocked(canAccessUnscopedSite).mockResolvedValue(false)
    const response = await handler(request(mode !== 'anonymous'))
    expect(response.status).toBe(['anonymous', 'invalid-session'].includes(mode) ? 401 : 403)
    expect(from).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('validates the site identifier before accessing billing', async () => {
    expect((await handler(request(true, 'invalid'))).status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })

  it('does not revive expired trial or plan credits', async () => {
    query.single.mockResolvedValue({ data: {
      plan: 'free', status: 'inactive', credits_available: 7, account_balance: 0,
      trial_credits_available: 5, trial_started_at: '2000-01-01T00:00:00Z', trial_ends_at: '2000-01-16T00:00:00Z',
      plan_credits_available: 2, plan_credit_period_start: '2000-01-01T00:00:00Z', plan_credit_period_end: '2000-02-01T00:00:00Z',
    }, error: null })
    const response = await handler(request())
    expect(await response.json()).toMatchObject(kind === 'credits' ? { hasCredits: false, spendable_credits: 0 } : { hasBillingSetup: false })
  })
})