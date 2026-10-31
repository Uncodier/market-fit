import { act, renderHook } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { invalidateAgentsCache } from '@/app/agents/agents-cache'
import { LOCATION_REVISION_TIMEOUT_MS, useLocationPermissionRevision } from '@/app/hooks/use-location-permission-revision'
import { usePathname } from 'next/navigation'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/agents/agents-cache', () => ({ invalidateAgentsCache: jest.fn() }))
const site = '00000000-0000-4000-8000-000000000001'
const scope = { site_id: site, role: 'collaborator', revision: 0, restricted_location_ids: [] }
const rpc = jest.fn()
const getUser = jest.fn()
const reset = jest.fn()
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks()
  jest.mocked(usePathname).mockReturnValue('/catalog')
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  rpc.mockResolvedValue({ data: scope, error: null })
  getUser.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null })
  jest.mocked(createClient).mockReturnValue({ rpc, auth: { getUser } } as never)
})
afterEach(() => jest.useRealTimers())

it('leaves POS refresh and revocation to its local access gate without resetting the document', async () => {
  jest.mocked(usePathname).mockReturnValue('/pos')
  renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  act(() => {
    window.dispatchEvent(new Event('focus'))
    jest.advanceTimersByTime(60_000)
  })
  await settle()
  expect(getUser).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
  expect(reset).not.toHaveBeenCalled()
})

it('retires the global check when navigating to POS and restores it on other routes', async () => {
  const hook = renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  let resolve!: (value: unknown) => void
  rpc.mockReturnValueOnce(new Promise(done => { resolve = done }))
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  jest.mocked(usePathname).mockReturnValue('/pos')
  hook.rerender()
  await act(async () => resolve({ data: null, error: { code: '42501' } }))
  act(() => jest.advanceTimersByTime(60_000))
  expect(reset).not.toHaveBeenCalled()
  jest.mocked(usePathname).mockReturnValue('/pos/check-in')
  hook.rerender()
  await settle()
  rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  expect(reset).toHaveBeenCalledTimes(1)
})

it('retires warm data when the real scope RPC raises a revocation error', async () => {
  renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  expect(invalidateAgentsCache).toHaveBeenCalledTimes(1)
  expect(reset).toHaveBeenCalledTimes(1)
})

it.each(['/orders', '/pos'])('retains the revision baseline across navigation through %s', async (path) => {
  const hook = renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  jest.mocked(usePathname).mockReturnValue(path)
  hook.rerender()
  await settle()
  rpc.mockResolvedValue({ data: { ...scope, revision: 1 }, error: null })
  jest.mocked(usePathname).mockReturnValue('/leads')
  hook.rerender()
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  expect(invalidateAgentsCache).toHaveBeenCalledTimes(1)
  expect(reset).toHaveBeenCalledTimes(1)
})

it('expires a hung refresh and ignores its eventual result', async () => {
  let resolve!: (value: unknown) => void
  renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  rpc.mockReturnValue(new Promise(done => { resolve = done }))
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  act(() => jest.advanceTimersByTime(LOCATION_REVISION_TIMEOUT_MS))
  expect(reset).toHaveBeenCalledTimes(1)
  await act(async () => resolve({ data: scope, error: null }))
  expect(reset).toHaveBeenCalledTimes(1)
})

it('does not extend a pending verification deadline on ordinary navigation', async () => {
  const hook = renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  rpc.mockReturnValue(new Promise(() => {}))
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  for (const pathname of ['/orders', '/leads', '/catalog']) {
    act(() => jest.advanceTimersByTime(2_000))
    jest.mocked(usePathname).mockReturnValue(pathname)
    hook.rerender()
    await settle()
  }
  act(() => jest.advanceTimersByTime(2_000))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledTimes(2)
})

it('does not discard a pending denial on ordinary navigation', async () => {
  const hook = renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  let resolve!: (value: unknown) => void
  rpc.mockReturnValueOnce(new Promise(done => { resolve = done }))
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  jest.mocked(usePathname).mockReturnValue('/orders')
  hook.rerender()
  await settle()
  await act(async () => resolve({ data: null, error: { code: '42501' } }))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledTimes(2)
})

it('does not loop-reload on missing setup at initial load, but retries after timeout', async () => {
  getUser.mockReturnValueOnce(new Promise(() => undefined))
  renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  act(() => jest.advanceTimersByTime(LOCATION_REVISION_TIMEOUT_MS))
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  expect(getUser).toHaveBeenCalledTimes(2)
  expect(reset).not.toHaveBeenCalled()
})