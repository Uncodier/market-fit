/** @jest-environment node */
import { GET } from '@/app/api/billing/presence/route'
import { refreshSiteBillingRecord } from '@/app/context/site-refresh-billing'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { lookupCurrentUserSiteRole } from '@/lib/auth/site-role-lookup'
import { canAccessUnscopedSite } from '@/lib/permissions/location-boundary'
import type { Site } from '@/app/context/site-types'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/site-role-lookup', () => ({
  lookupCurrentUserSiteRole: jest.fn(), SiteRoleLookupError: class extends Error {},
}))
jest.mock('@/lib/permissions/location-boundary', () => ({ canAccessUnscopedSite: jest.fn() }))
jest.mock('@/lib/permissions/location-access', () => ({ userCanOnLocation: jest.fn() }))

const siteId = '11111111-1111-4111-8111-111111111111'
const getUser = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), abortSignal: jest.fn(), maybeSingle: jest.fn() }
const from = jest.fn()
const single = jest.fn()
const request = (search = `site_id=${siteId}`, cookie = 'session=synthetic') =>
  new Request(`https://app.example.test/api/billing/presence?${search}`, { headers: { cookie } })

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never)
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue('owner')
  jest.mocked(canAccessUnscopedSite).mockResolvedValue(true)
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.abortSignal.mockReturnValue(query)
  query.maybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
  from.mockReturnValue(query)
  jest.mocked(createServiceClient).mockResolvedValue({ from } as never)
  const browserQuery = { select: () => browserQuery, eq: () => browserQuery,
    abortSignal: () => browserQuery, single }
  single.mockReset().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  jest.mocked(createBrowserClient).mockReturnValue({ from: () => browserQuery } as never)
  jest.mocked(fetch).mockImplementation(async input => GET(new Request(`https://app.example.test${input}`, {
    headers: { cookie: 'session=synthetic' },
  })))
})

it('authenticates and authorizes before a minimal service read; returns only presence', async () => {
  query.maybeSingle.mockResolvedValue({ data: { site_id: siteId, credits_available: 999 }, error: null })
  const response = await GET(request())
  expect(await response.json()).toEqual({ status: 'present' })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(lookupCurrentUserSiteRole).toHaveBeenCalledWith(expect.anything(), siteId)
  expect(canAccessUnscopedSite).toHaveBeenCalledWith(expect.anything(), siteId)
  expect(jest.mocked(canAccessUnscopedSite).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
  expect(createServiceClient).toHaveBeenCalledWith(true)
  expect(from).toHaveBeenCalledWith('billing')
  expect(query.select).toHaveBeenCalledWith('site_id')
  expect(query.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it.each(['', 'site_id=invalid', `site_id=${siteId}&site_id=${siteId}`, `site_id=${siteId}&user_id=forged`])(
  'rejects invalid input before privileged reads: %s', async search => {
    expect((await GET(request(search))).status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  },
)

it('denies anonymous requests before creating clients', async () => {
  expect((await GET(request(undefined, ''))).status).toBe(401)
  expect(createClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each(['invalid-session', 'foreign-site', 'restricted-location'])(
  'denies %s before service access', async scenario => {
    if (scenario === 'invalid-session') getUser.mockResolvedValue({ data: { user: null }, error: null })
    if (scenario === 'foreign-site') jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(null)
    if (scenario === 'restricted-location') jest.mocked(canAccessUnscopedSite).mockResolvedValue(false)
    const response = await GET(request())
    expect(response.status).toBe(scenario === 'invalid-session' ? 401 : 403)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(createServiceClient).not.toHaveBeenCalled()
  },
)

it.each(['database', 'transport', 'authorization', 'malformed-result'])(
  'does not report missing during %s failure', async scenario => {
    if (scenario === 'database') query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Private error' } })
    if (scenario === 'transport') query.maybeSingle.mockRejectedValue(new Error('Private error'))
    if (scenario === 'authorization') jest.mocked(lookupCurrentUserSiteRole).mockRejectedValueOnce(new Error('Private error'))
    if (scenario === 'malformed-result') query.maybeSingle.mockResolvedValue({ data: undefined, error: null })
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Billing presence could not be confirmed' })
  },
)

it.each([null, { code: 'PGRST116' }])('real refresh publishes confirmed missing, not a fabricated grant (RLS error %j)', async error => {
  single.mockResolvedValue({ data: null, error })
  const saved = { id: siteId, settings: { about: 'Keep settings' }, billing_read_status: 'unavailable',
    billing: { plan: 'engine', credits_available: 100 } } as Site
  let current: Site | null = saved
  let sites = [saved]
  await refreshSiteBillingRecord(siteId, {
    setSites: update => { sites = typeof update === 'function' ? update(sites) : update },
    setCurrentSite: update => { current = typeof update === 'function' ? update(current) : update },
  })
  expect(current).toEqual({ ...saved, billing: undefined, billing_read_status: 'missing' })
  expect(sites).toEqual([current])
  expect(fetch).toHaveBeenCalledWith(`/api/billing/presence?site_id=${siteId}`, expect.objectContaining({
    credentials: 'include', cache: 'no-store', signal: expect.any(AbortSignal),
  }))
})

it.each(['unauthorized', 'outage', 'hidden-row', 'invalid-payload', 'RLS-outage'])(
  'real refresh cannot turn %s into missing or replace prior balances', async scenario => {
    if (scenario === 'unauthorized') jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(null)
    if (scenario === 'outage') query.maybeSingle.mockResolvedValue({ data: null, error: { code: '08006' } })
    if (scenario === 'hidden-row') query.maybeSingle.mockResolvedValue({ data: { site_id: siteId }, error: null })
    if (scenario === 'invalid-payload') jest.mocked(fetch).mockResolvedValueOnce(Response.json({}))
    if (scenario === 'RLS-outage') single.mockResolvedValue({ data: null, error: { code: '08006' } })
    const deps = { setSites: jest.fn(), setCurrentSite: jest.fn() }
    await expect(refreshSiteBillingRecord(siteId, deps)).rejects.toThrow('could not be loaded')
    expect(deps.setSites).not.toHaveBeenCalled()
    expect(deps.setCurrentSite).not.toHaveBeenCalled()
    if (scenario === 'RLS-outage') expect(fetch).not.toHaveBeenCalled()
  },
)

it.each(['authorization', 'database'])('bounds a stalled %s and prevents privileged work after timeout', async stage => {
  jest.useFakeTimers()
  try {
    let finish!: () => void
    if (stage === 'authorization') {
      jest.mocked(lookupCurrentUserSiteRole).mockReturnValueOnce(new Promise(resolve => { finish = () => resolve('owner') }))
    } else {
      query.maybeSingle.mockReturnValueOnce(new Promise(resolve => { finish = () => resolve({ data: null, error: null }) }))
    }
    const pending = GET(request())
    await jest.advanceTimersByTimeAsync(6_000)
    const response = await pending
    expect(response.status).toBe(503)
    if (stage === 'database') expect(query.abortSignal.mock.calls[0][0].aborted).toBe(true)
    finish()
    await jest.advanceTimersByTimeAsync(0)
    if (stage === 'authorization') expect(createServiceClient).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

it('bounds the combined RLS and server-presence reader, aborting late confirmation', async () => {
  jest.useFakeTimers()
  try {
    let finish!: (value: Response) => void
    jest.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const deps = { setSites: jest.fn(), setCurrentSite: jest.fn() }
    const pending = refreshSiteBillingRecord(siteId, deps)
    const rejected = expect(pending).rejects.toThrow('could not be loaded')
    await jest.advanceTimersByTimeAsync(8_000)
    await rejected
    expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
    finish(Response.json({ status: 'missing' }))
    await jest.advanceTimersByTimeAsync(0)
    expect(deps.setSites).not.toHaveBeenCalled()
    expect(deps.setCurrentSite).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})