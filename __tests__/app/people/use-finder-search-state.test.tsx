import { act, renderHook } from '@testing-library/react'
import { useFinderSearch } from '@/app/people/use-finder-search'
import { toast } from 'sonner'
import { deferred } from './test-helpers'

const mockGetSession = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: () => mockGetSession() } }),
}))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

const filters = { site_id: 'provided-site', page: 0, role_title: ['Founder'] }
const searchData = { search_results: [{ id: 'person-a' }], total_search_results: 3 }
const totalsData = { total_persons: 2 }

function jsonResponse(body: unknown, status = 200): Response {
  // Only the Fetch fields consumed by the API client are needed in this fixture.
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function respond(search: unknown, totals: unknown, searchStatus = 200, totalsStatus = 200) {
  jest.mocked(fetch).mockImplementation(async url =>
    jsonResponse(
      String(url).endsWith('/totals') ? totals : search,
      String(url).endsWith('/totals') ? totalsStatus : searchStatus,
    ),
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: { access_token: 'test-user-token' } } })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { jest.restoreAllMocks() })

it.each(['direct', 'wrapped'])('publishes completed-empty success only after valid %s responses', async format => {
  const search = { search_results: [], total_search_results: 0 }
  const totals = { total_persons: 0 }
  respond(
    format === 'wrapped' ? { success: true, data: search } : search,
    format === 'wrapped' ? { success: true, data: totals } : totals,
  )
  const onResults = jest.fn()
  const { result } = renderHook(() => useFinderSearch({ siteId: 'site-a', onResults }))
  expect(result.current).toMatchObject({ status: 'idle', error: null, loading: false })

  await act(async () => { await result.current.executeSearch(filters) })

  expect(result.current).toMatchObject({ status: 'success', error: null, loading: false })
  expect(onResults).toHaveBeenCalledTimes(1)
  expect(onResults).toHaveBeenCalledWith([], 0)
  expect(toast.error).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const suffix of ['', '/totals']) {
    expect(fetch).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-user-token' }),
      body: JSON.stringify({ ...filters, site_id: 'site-a' }),
    }))
  }
  expect(filters.site_id).toBe('provided-site')
})

it.each([
  ['search HTTP denial', { error: { message: 'Authentication required' } }, totalsData, 401, 200],
  ['totals HTTP denial', searchData, { error: { message: 'Access denied' } }, 200, 403],
  ['search provider failure', { success: false, error: { message: 'Search unavailable' } }, totalsData, 200, 200],
  ['totals provider failure', searchData, { success: false, error: { message: 'Totals unavailable' } }, 200, 200],
  ['search nested failure', { success: true, data: { ...searchData, success: false } }, totalsData, 200, 200],
  ['totals nested failure', searchData, { success: true, data: { ...totalsData, success: false } }, 200, 200],
  ['search nested error', { success: true, data: { ...searchData, error: 'Provider failed' } }, totalsData, 200, 200],
  ['totals nested error', searchData, { success: true, data: { ...totalsData, error: 'Provider failed' } }, 200, 200],
  ['search error without success flag', { ...searchData, error: { message: 'Search unavailable' } }, totalsData, 200, 200],
  ['totals error without success flag', searchData, { ...totalsData, error: { message: 'Totals unavailable' } }, 200, 200],
] as const)('clears rows with error status for %s through the real API client', async (_name, search, totals, searchStatus, totalsStatus) => {
  respond(search, totals, searchStatus, totalsStatus)
  const onResults = jest.fn()
  const { result } = renderHook(() => useFinderSearch({ siteId: 'site-a', onResults }))

  await act(async () => { await result.current.executeSearch(filters) })

  expect(result.current).toMatchObject({ status: 'error', error: expect.any(String), loading: false })
  expect(result.current.isSearchPending()).toBe(false)
  expect(onResults).toHaveBeenCalledTimes(1)
  expect(onResults).toHaveBeenCalledWith([], 0)
  expect(toast.error).toHaveBeenCalledTimes(1)
  expect(toast.error).toHaveBeenCalledWith(result.current.error)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([
  ['missing results', {}, totalsData],
  ['null results', { search_results: null }, totalsData],
  ['non-array results', { search_results: {} }, totalsData],
  ['invalid result rows', { search_results: [null] }, totalsData],
  ['non-object search body', 'Not JSON', totalsData],
  ['missing totals', searchData, {}],
  ['missing persons count with fallback count', searchData, { total_search_results: 3 }],
  ['string persons count', searchData, { total_persons: '2' }],
  ['negative persons count', searchData, { total_persons: -1 }],
  ['fractional persons count', searchData, { total_persons: 1.5 }],
  ['unsafe persons count', searchData, { total_persons: Number.MAX_SAFE_INTEGER + 1 }],
  ['non-object totals body', searchData, []],
] as const)('rejects %s rather than treating malformed data as completed-empty', async (_name, search, totals) => {
  respond(search, totals)
  const onResults = jest.fn()
  const { result } = renderHook(() => useFinderSearch({ onResults }))

  await act(async () => { await result.current.executeSearch(filters) })

  expect(result.current.status).toBe('error')
  expect(result.current.loading).toBe(false)
  expect(onResults).toHaveBeenCalledTimes(1)
  expect(onResults).toHaveBeenCalledWith([], 0)
  expect(toast.error).toHaveBeenCalledTimes(1)
})

it('clears previous results with error status and clears the error while a manual retry is pending', async () => {
  respond(searchData, totalsData)
  const onResults = jest.fn()
  const { result } = renderHook(() => useFinderSearch({ onResults }))
  await act(async () => { await result.current.executeSearch(filters) })
  expect(onResults).toHaveBeenCalledWith(searchData.search_results, 2)

  respond(searchData, { success: false, error: { message: 'Totals unavailable' } })
  await act(async () => { await result.current.executeSearch(filters) })
  expect(result.current).toMatchObject({ status: 'error', error: 'Totals unavailable', loading: false })
  expect(onResults).toHaveBeenCalledTimes(2)
  expect(onResults).toHaveBeenLastCalledWith([], 0)
  expect(toast.error).toHaveBeenCalledWith('Totals unavailable')

  const retry = deferred<Response>()
  jest.mocked(fetch).mockImplementation(async url => String(url).endsWith('/totals')
    ? jsonResponse(totalsData)
    : retry.promise)
  let pending!: Promise<void>
  await act(async () => { pending = result.current.executeSearch(filters) })
  expect(result.current).toMatchObject({ status: 'loading', error: null, loading: true })
  expect(onResults).toHaveBeenCalledTimes(2)
  await act(async () => {
    retry.resolve(jsonResponse(searchData))
    await pending
  })
  expect(result.current).toMatchObject({ status: 'success', error: null, loading: false })
  expect(onResults).toHaveBeenCalledTimes(3)
  expect(onResults).toHaveBeenLastCalledWith(searchData.search_results, 2)
  expect(fetch).toHaveBeenCalledTimes(6)
})