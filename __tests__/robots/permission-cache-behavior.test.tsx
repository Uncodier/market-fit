import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { RobotsProvider, useRobots } from '@/app/context/RobotsContext'
import { ROBOTS_PERMISSION_TIMEOUT_MS } from '@/app/hooks/use-robots-permission-revision'

let mockActor = 'actor-a'
let mockSite = 'site-a'
let mockRestricted = false
let mockRole = 'collaborator'
let mockStatus = 'active'
const mockGetUser = jest.fn()
const mockMembership = jest.fn()
const mockCapabilities = jest.fn()
const mockRobots = jest.fn()
const mockSignals: AbortSignal[] = []
const mockFilters: Array<[string, string, unknown]> = []
const mockListeners: Array<(payload: unknown) => void> = []

jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: mockActor } }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSite } }) }))
jest.mock('next/navigation', () => ({ usePathname: () => '/robots' }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => { mockFilters.push([table, field, value]); return builder },
        maybeSingle: () => builder,
        abortSignal: (signal: AbortSignal) => { mockSignals.push(signal); return mockMembership() },
        order: () => mockRobots(),
      }
      return builder
    },
    rpc: () => ({ abortSignal: (signal: AbortSignal) => { mockSignals.push(signal); return mockCapabilities() } }),
    channel: () => {
      const channel = {
        on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => {
          mockListeners.push(callback); return channel
        },
        subscribe: () => channel,
      }
      return channel
    },
    removeChannel: jest.fn(),
  }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const row = (id: string) => ({ id, name: 'Assistant Session', site_id: mockSite, status: 'running', is_archived: false })
const result = (id: string) => ({ data: [row(id)], error: null })
function Consumer() {
  const robots = useRobots()
  return <><button onClick={() => void robots.refreshRobots()}>Refresh</button><output data-testid="robots">{JSON.stringify({
    all: robots.getAllInstances(true).map(r => r.id),
    activity: robots.getRobotsForActivity('Assistant Session').map(r => r.id),
    running: robots.totalRunningRobots,
    loading: robots.isLoading,
    refreshCount: robots.refreshCount,
  })}</output></>
}
function mount() {
  const cache = new Map()
  const tree = () => <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
    <RobotsProvider><Consumer /></RobotsProvider>
  </SWRConfig>
  const view = render(tree())
  return { ...view, change: () => view.rerender(tree()) }
}
async function settle() { await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }) }
async function focus() { await act(async () => { window.dispatchEvent(new Event('focus')) }); await settle() }
function expectEmpty() {
  expect(screen.getByTestId('robots')).toHaveTextContent('"all":[]')
  expect(screen.getByTestId('robots')).toHaveTextContent('"activity":[]')
  expect(screen.getByTestId('robots')).toHaveTextContent('"running":0')
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.resetAllMocks()
  mockActor = 'actor-a'; mockSite = 'site-a'; mockRestricted = false
  mockRole = 'collaborator'; mockStatus = 'active'
  mockSignals.length = 0; mockFilters.length = 0; mockListeners.length = 0
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  mockGetUser.mockImplementation(async () => ({ data: { user: { id: mockActor } }, error: null }))
  mockMembership.mockImplementation(async () => ({ data: {
    role: mockRole, status: mockStatus, restrict_to_assigned_only: mockRestricted,
  }, error: null }))
  mockCapabilities.mockImplementation(async () => ({ data: { role: mockRole, is_owner: false }, error: null }))
  mockRobots.mockResolvedValue(result('foreign'))
})
afterEach(() => { jest.useRealTimers() })

it('retires same-actor data on restriction changes and never reuses a toggled-back cache', async () => {
  mount(); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('foreign')
  const oldListener = mockListeners[0]
  const fresh = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(fresh.promise)
  mockRestricted = true
  await focus()
  expectEmpty()
  expect(mockRobots).toHaveBeenCalledTimes(2)
  act(() => oldListener({ eventType: 'INSERT', new: row('stale-realtime') }))
  expectEmpty()
  await act(async () => { fresh.resolve(result('own')) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('own')
  expect(screen.getByTestId('robots')).not.toHaveTextContent('foreign')
  const expanded = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(expanded.promise)
  mockRestricted = false
  await focus(); expectEmpty()
  expect(mockRobots).toHaveBeenCalledTimes(3)
  await act(async () => { expanded.resolve(result('expanded-fresh')) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('expanded-fresh')
  expect(mockFilters).toContainEqual(['site_members', 'user_id', 'actor-a'])
  expect(mockFilters).toContainEqual(['site_members', 'site_id', 'site-a'])
})

it.each(['actor', 'site'])('masks old data and ignores late list/permission responses after %s changes', async kind => {
  const view = mount(); await settle()
  const pending = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(pending.promise)
  act(() => { screen.getByText('Refresh').click() }); await settle()
  const permission = deferred<{ data: { role: string; status: string; restrict_to_assigned_only: boolean }; error: null }>()
  mockMembership.mockReturnValueOnce(permission.promise)
  await focus()
  if (kind === 'actor') mockActor = 'actor-b'
  else mockSite = 'site-b'
  const fresh = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(fresh.promise)
  view.change(); expectEmpty(); await settle(); expectEmpty()
  await act(async () => {
    pending.resolve(result('late-old-list'))
    permission.resolve({ data: { role: 'collaborator', status: 'active', restrict_to_assigned_only: true }, error: null })
  }); await settle(); expectEmpty()
  await act(async () => { fresh.resolve(result('new-scope')) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('new-scope')
  expect(screen.getByTestId('robots')).not.toHaveTextContent('late-old')
})

it('retains confirmed data on network failure and bounds visible single-flight polling', async () => {
  mount(); await settle()
  mockMembership.mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } })
  await focus()
  expect(screen.getByTestId('robots')).toHaveTextContent('foreign')
  const hanging = deferred<unknown>()
  mockMembership.mockReturnValueOnce(hanging.promise)
  await focus()
  const calls = mockMembership.mock.calls.length
  const signal = mockSignals[mockSignals.length - 1]
  await act(async () => { jest.advanceTimersByTime(ROBOTS_PERMISSION_TIMEOUT_MS + 60000) })
  await focus()
  expect(signal.aborted).toBe(true)
  expect(mockMembership).toHaveBeenCalledTimes(calls)
  expect(screen.getByTestId('robots')).toHaveTextContent('foreign')
  await act(async () => { hanging.resolve({ data: null, error: null }) }); await settle()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  await act(async () => { jest.advanceTimersByTime(30000) }); await focus()
  expect(mockMembership).toHaveBeenCalledTimes(calls)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  mockRestricted = true
  mockRobots.mockResolvedValue(result('poll-fresh'))
  await act(async () => { window.dispatchEvent(new Event('online')) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('poll-fresh')
})

it('masks a confirmed inactive membership rather than treating it as a transport error', async () => {
  mount(); await settle()
  mockStatus = 'rejected'
  await focus(); expectEmpty()
  expect(screen.getByTestId('robots')).toHaveTextContent('"loading":false')
})

it('reports pending confirmation as loading even with a previous refresh count', async () => {
  const initialAuth = deferred<{ data: { user: { id: string } }; error: null }>()
  mockGetUser.mockReturnValueOnce(initialAuth.promise)
  const view = mount(); await settle()
  expectEmpty()
  expect(screen.getByTestId('robots')).toHaveTextContent('"loading":true')
  expect(mockRobots).not.toHaveBeenCalled()
  await act(async () => { initialAuth.resolve({ data: { user: { id: mockActor } }, error: null }) }); await settle()
  act(() => { screen.getByText('Refresh').click() }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('"refreshCount":1')
  const auth = deferred<unknown>()
  mockGetUser.mockReturnValueOnce(auth.promise)
  mockSite = 'site-b'
  view.change(); await settle()
  expectEmpty()
  expect(screen.getByTestId('robots')).toHaveTextContent('"refreshCount":1')
  expect(screen.getByTestId('robots')).toHaveTextContent('"loading":true')
  await act(async () => { auth.resolve({ data: { user: { id: mockActor } }, error: null }) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('"loading":false')
})

it.each(['collaborator', 'owner'])('honors explicit select denial for %s and distinguishes it from pending', async role => {
  mockRole = role
  mount(); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('foreign')
  mockCapabilities.mockResolvedValue({ data: { role, is_owner: role === 'owner', select: false }, error: null })
  await focus(); expectEmpty()
  expect(screen.getByTestId('robots')).toHaveTextContent('"loading":false')
  expect(mockRobots).toHaveBeenCalledTimes(1)
  mockCapabilities.mockResolvedValue({ data: { role, is_owner: role === 'owner', select: true }, error: null })
  mockRobots.mockResolvedValue(result('permission-restored'))
  await focus()
  expect(screen.getByTestId('robots')).toHaveTextContent('permission-restored')
  expect(mockRobots).toHaveBeenCalledTimes(2)
})

it('does not expose warm data when returning to a previous actor before permission confirmation', async () => {
  const view = mount(); await settle()
  mockActor = 'actor-b'
  mockRobots.mockResolvedValue(result('actor-b-robot'))
  view.change(); expectEmpty(); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('actor-b-robot')
  const auth = deferred<{ data: { user: { id: string } }; error: null }>()
  mockGetUser.mockReturnValueOnce(auth.promise)
  mockActor = 'actor-a'
  view.change(); expectEmpty(); await settle(); expectEmpty()
  mockRobots.mockResolvedValue(result('actor-a-fresh'))
  await act(async () => { auth.resolve({ data: { user: { id: 'actor-a' } }, error: null }) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('actor-a-fresh')
  expect(mockRobots).toHaveBeenCalledTimes(3)
})

it('checks permissions at the visible 30s interval and aborts work on unmount', async () => {
  const view = mount(); await settle()
  mockRestricted = true
  mockRobots.mockResolvedValue(result('interval-fresh'))
  await act(async () => { jest.advanceTimersByTime(30000) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('interval-fresh')
  const pending = deferred<unknown>()
  mockMembership.mockReturnValueOnce(pending.promise)
  await focus()
  const signal = mockSignals[mockSignals.length - 1]
  const calls = mockMembership.mock.calls.length
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => {
    window.dispatchEvent(new Event('online'))
    jest.advanceTimersByTime(60000)
    pending.resolve({ data: null, error: null })
  })
  expect(mockMembership).toHaveBeenCalledTimes(calls)
})