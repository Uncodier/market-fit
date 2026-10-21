import { act, renderHook } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { invalidateAgentsCache } from '@/app/agents/agents-cache'
import { LOCATION_REVISION_TIMEOUT_MS, useLocationPermissionRevision } from '@/app/hooks/use-location-permission-revision'

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
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  rpc.mockResolvedValue({ data: scope, error: null })
  getUser.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null })
  jest.mocked(createClient).mockReturnValue({ rpc, auth: { getUser } } as never)
})
afterEach(() => jest.useRealTimers())

it('retires warm data when the real scope RPC raises a revocation error', async () => {
  renderHook(() => useLocationPermissionRevision(site, reset))
  await settle()
  rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
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