/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/site-member-request', () => ({ createUserSupabase: jest.fn(), createServiceSupabase: jest.fn() }))
jest.mock('@/lib/sites/selector-cache', () => ({ readSelectorSites: jest.fn() }))
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))

import { GET } from '@/app/api/sites/route'
import { createUserSupabase, createServiceSupabase } from '@/lib/auth/site-member-request'
import { readSelectorSites } from '@/lib/sites/selector-cache'
import { createClient } from '@supabase/supabase-js'

const getUser = jest.fn()
const gate = jest.fn()
const rpc = jest.fn(() => ({ abortSignal: gate }))
const request = () => new Request('https://example.test/api/sites?view=selector')
beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'actor' } }, error: null })
  gate.mockReset().mockResolvedValue({ data: false, error: null })
  jest.mocked(createUserSupabase).mockResolvedValue({ auth: { getUser }, rpc } as never)
  jest.mocked(readSelectorSites).mockResolvedValue({ sites: [{ id: 'site' }], authoritative: false, cache: 'hit', cacheReason: 'hit' })
})

it('verifies identity and location before reading cache without legacy billing/detail queries', async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ authoritative: false, sites: [{ id: 'site' }] })
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('current_user_has_location_restrictions')
  expect(readSelectorSites).toHaveBeenCalledWith('actor', expect.any(Function), false)
  expect(createServiceSupabase).not.toHaveBeenCalled()
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('x-sites-cache-reason')).toBe('hit')
  expect(response.headers.get('server-timing')).toContain('total;dur=')
  expect(response.headers.get('server-timing')).toContain('auth;dur=')
  expect(response.headers.get('server-timing')).toContain('location;dur=')
  expect(response.headers.get('server-timing')).toContain('list;dur=')
})

it.each([401, 403, 429, 500, 503, 0])('classifies auth status %s without leaking diagnostics', async status => {
  getUser.mockResolvedValue({ data: { user: null }, error: { status, message: 'Sensitive diagnostic' } })
  const response = await GET(request())
  expect(response.status).toBe([401, 403].includes(status) ? 401 : 503)
  expect(await response.text()).not.toContain('Sensitive')
  expect(readSelectorSites).not.toHaveBeenCalled()
})

it.each([true, null])('does not bypass failed or restricted location verification (%s)', async data => {
  gate.mockResolvedValue({ data, error: null })
  expect((await GET(request())).status).toBe(data ? 403 : 503)
  expect(readSelectorSites).not.toHaveBeenCalled()
})

it('bounds stalled authentication and aborts its transport', async () => {
  jest.useFakeTimers()
  try {
    getUser.mockReturnValue(new Promise(() => {}))
    const pending = GET(request())
    await jest.advanceTimersByTimeAsync(8_000)
    const response = await pending
    expect(response.status).toBe(503)
    expect(response.headers.get('x-sites-timeout-stage')).toBe('auth')
    expect(response.headers.get('server-timing')).toContain('auth;dur=8000.0')
    expect(jest.mocked(createUserSupabase).mock.calls[0][0]?.aborted).toBe(true)
    expect(readSelectorSites).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

it('rejects mixed selector/detail input', async () => {
  const response = await GET(new Request('https://example.test/api/sites?view=selector&detail=foreign'))
  expect(response.status).toBe(400)
  expect(getUser).not.toHaveBeenCalled()
})

it('allows fresh metadata reads only after the same authentication and location checks', async () => {
  const response = await GET(new Request('https://example.test/api/sites?view=selector&fresh=1'))
  expect(response.status).toBe(200)
  expect(readSelectorSites).toHaveBeenCalledWith('actor', expect.any(Function), true)
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(gate).toHaveBeenCalledTimes(1)
})

it('passes the remaining Redis freshness budget without treating cached membership as current authorization', async () => {
  jest.mocked(readSelectorSites).mockResolvedValueOnce({ sites: [{ id: 'site' }],
    authoritative: false, cache: 'hit', cacheReason: 'hit', revalidateAfterMs: 27_000 })
  expect(await (await GET(request())).json()).toMatchObject({ authoritative: false, revalidateAfterMs: 27_000 })
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(gate).toHaveBeenCalledTimes(1)
})

it('reports thrown auth transport failure as temporary unavailability', async () => {
  getUser.mockRejectedValue(new Error('Private transport diagnostic'))
  const response = await GET(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('Private')
  expect(readSelectorSites).not.toHaveBeenCalled()
})

it('creates the list-only service client after the gate, with bounded DB transport', async () => {
  const databaseSignal = new AbortController().signal
  jest.mocked(readSelectorSites).mockImplementationOnce(async (_actor, factory) => {
    expect(gate).toHaveBeenCalledTimes(1)
    factory(databaseSignal)
    return { sites: [], authoritative: true, cache: 'miss', cacheReason: 'empty' }
  })
  await GET(request())
  expect(createClient).toHaveBeenCalledTimes(1)
  const options = jest.mocked(createClient).mock.calls[0][2]!
  expect(options.auth).toEqual({ persistSession: false, autoRefreshToken: false })
  const transport = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
  try {
    await options.global!.fetch!('https://example.test/rest/v1/sites')
    expect(transport).toHaveBeenCalledWith('https://example.test/rest/v1/sites', { signal: databaseSignal, cache: 'no-store' })
  } finally { transport.mockRestore() }
})

it.each(['location', 'list'] as const)('reports a stalled %s stage without caching authorization', async stage => {
  jest.useFakeTimers()
  try {
    if (stage === 'location') gate.mockReturnValue(new Promise(() => {}))
    else jest.mocked(readSelectorSites).mockReturnValueOnce(new Promise(() => {}))
    const pending = GET(request())
    await jest.advanceTimersByTimeAsync(8_000)
    const response = await pending
    expect(response.status).toBe(503)
    expect(response.headers.get('x-sites-timeout-stage')).toBe(stage)
    expect(response.headers.get('server-timing')).toContain(`${stage};dur=8000.0`)
    expect(response.headers.get('retry-after')).toBe('2')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(getUser).toHaveBeenCalledTimes(1)
    if (stage === 'location') expect(readSelectorSites).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

it('retains completed stage timing when the cache fill fails without exposing provider diagnostics', async () => {
  jest.mocked(readSelectorSites).mockRejectedValueOnce(new Error('private-cache-key-and-token'))
  const response = await GET(request())
  expect(response.status).toBe(503)
  expect(response.headers.get('server-timing')).toMatch(/auth;dur=.*location;dur=.*list;dur=.*total;dur=/)
  expect(response.headers.has('x-sites-timeout-stage')).toBe(false)
  expect(await response.text()).not.toContain('private-cache-key-and-token')
})

it('does not start the location RPC or cache read before fresh identity succeeds', async () => {
  let finishAuth!: (value: unknown) => void
  let finishGate!: (value: unknown) => void
  getUser.mockReturnValue(new Promise(resolve => { finishAuth = resolve }))
  gate.mockReturnValue(new Promise(resolve => { finishGate = resolve }))
  const pending = GET(request())
  await new Promise(resolve => setImmediate(resolve))
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(gate).not.toHaveBeenCalled()
  expect(readSelectorSites).not.toHaveBeenCalled()
  finishAuth({ data: { user: { id: 'actor' } }, error: null })
  await new Promise(resolve => setImmediate(resolve))
  expect(gate).toHaveBeenCalledTimes(1)
  expect(readSelectorSites).not.toHaveBeenCalled()
  finishGate({ data: false, error: null })
  expect((await pending).status).toBe(200)
  expect(readSelectorSites).toHaveBeenCalledTimes(1)
})

it('denies failed identity without querying the location RPC', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } })
  gate.mockReturnValue(new Promise(() => {}))
  const response = await GET(request())
  expect(response.status).toBe(401)
  expect(jest.mocked(createUserSupabase).mock.calls[0][0]?.aborted).toBe(true)
  expect(readSelectorSites).not.toHaveBeenCalled()
  expect(gate).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
})

it('handles rejected location work without bypassing authentication', async () => {
  gate.mockRejectedValue(new Error('Private location failure'))
  const response = await GET(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('Private')
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(readSelectorSites).not.toHaveBeenCalled()
})

it('reports bounded cache I/O timings separately without exposing keys or actor IDs', async () => {
  jest.mocked(readSelectorSites).mockResolvedValueOnce({
    sites: [{ id: 'site' }], authoritative: true, cache: 'miss', cacheReason: 'unavailable',
    cacheReadMs: 250, cacheFillMs: 12.5,
  })
  const response = await GET(request())
  expect(response.headers.get('x-sites-cache')).toBe('miss')
  expect(response.headers.get('x-sites-cache-reason')).toBe('unavailable')
  expect(response.headers.get('server-timing')).toContain('redis_read;dur=250.0')
  expect(response.headers.get('server-timing')).toContain('redis_write;dur=12.5')
  expect(JSON.stringify([...response.headers])).not.toContain('actor')
  expect(await response.json()).not.toHaveProperty('cacheReadMs')
})

it('preserves the timeout stage when abort immediately rejects the underlying request', async () => {
  jest.useFakeTimers()
  try {
    jest.mocked(createUserSupabase).mockImplementationOnce(async signal => ({
      auth: { getUser: () => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
      }) }, rpc,
    }) as never)
    const pending = GET(request())
    await jest.advanceTimersByTimeAsync(8_000)
    const response = await pending
    expect(response.status).toBe(503)
    expect(response.headers.get('x-sites-timeout-stage')).toBe('auth')
    expect(readSelectorSites).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})