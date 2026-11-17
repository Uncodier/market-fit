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
  jest.mocked(readSelectorSites).mockResolvedValue({ sites: [{ id: 'site' }], authoritative: false, cache: 'hit' })
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
  expect(response.headers.get('server-timing')).toContain('total;dur=')
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
    authoritative: false, cache: 'hit', revalidateAfterMs: 27_000 })
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
    return { sites: [], authoritative: true, cache: 'miss' }
  })
  await GET(request())
  expect(createClient).toHaveBeenCalledTimes(1)
  const options = jest.mocked(createClient).mock.calls[0][2]!
  expect(options.auth).toEqual({ persistSession: false, autoRefreshToken: false })
  const transport = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
  try {
    await options.global!.fetch!('https://example.test/rest/v1/sites')
    expect(transport).toHaveBeenCalledWith('https://example.test/rest/v1/sites', { signal: databaseSignal })
  } finally { transport.mockRestore() }
})