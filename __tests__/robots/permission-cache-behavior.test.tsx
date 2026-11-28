import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { RobotsProvider, useRobots } from '@/app/context/RobotsContext'
import { ROBOTS_PERMISSION_TIMEOUT_MS } from '@/app/hooks/use-robots-permission-revision'

let mockActor = 'actor-a'
let mockSite = 'site-a'
let mockPath = '/robots'
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
const mockStatuses: Array<(status: string) => void> = []
const mockTopics: string[] = []
const mockRemoveChannel = jest.fn()

jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: mockActor } }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSite } }) }))
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }))
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
    channel: (topic: string) => {
      mockTopics.push(topic)
      const channel = {
        on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => {
          mockListeners.push(callback); return channel
        },
        subscribe: (callback: (status: string) => void) => { mockStatuses.push(callback); return channel },
      }
      return channel
    },
    removeChannel: mockRemoveChannel,
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
  mockTopics.length = 0; mockStatuses.length = 0; mockPath = '/robots'
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

async function visibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) }); await settle()
}

async function advance(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms) }); await settle()
}

it('retires the hidden channel and reconciles missed rows after joining, including SDK rejoins', async () => {
  const view = mount(); await settle()
  expect(mockTopics).toHaveLength(1)
  // The SDK may still be leaving the old topic when the tab wakes up.
  mockRemoveChannel.mockReturnValueOnce(new Promise(() => {}))
  await visibility('hidden')
  expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
  await act(async () => {
    window.dispatchEvent(new Event('online'))
    mockListeners[0]({ eventType: 'INSERT', new: row('retired') })
    mockStatuses[0]('SUBSCRIBED')
  })
  expect(mockTopics).toHaveLength(1)
  expect(mockRobots).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('robots')).not.toHaveTextContent('retired')

  await visibility('visible'); await visibility('visible')
  expect(mockTopics).toHaveLength(2)
  expect(mockTopics[1]).not.toBe(mockTopics[0])
  const pending = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(pending.promise).mockResolvedValue(result('caught-up'))
  await act(async () => { mockStatuses[1]('SUBSCRIBED') })
  const reads = mockRobots.mock.calls.length
  await act(async () => {
    mockListeners[1]({ eventType: 'UPDATE', new: row('during-read') })
    mockListeners[1]({ eventType: 'UPDATE', new: row('during-read') })
    pending.resolve(result('missed-while-hidden'))
  }); await settle()
  await advance(1000)
  expect(mockRobots).toHaveBeenCalledTimes(reads + 1)
  expect(screen.getByTestId('robots')).toHaveTextContent('caught-up')
  mockRobots.mockResolvedValue(result('after-transport-gap'))
  await act(async () => { mockStatuses[1]('CHANNEL_ERROR'); mockStatuses[1]('SUBSCRIBED') }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('after-transport-gap')
  act(() => mockListeners[1]({ eventType: 'INSERT', new: row('live') }))
  await settle(); expect(screen.getByTestId('robots')).toHaveTextContent('live')
  view.unmount()
  expect(mockRemoveChannel).toHaveBeenCalledTimes(2)
  await visibility('visible'); expect(mockTopics).toHaveLength(2)
})

it('bounds full reads across sustained row changes and converges to the authoritative list', async () => {
  mount(); await settle()
  let snapshot = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(snapshot.promise)
  act(() => mockStatuses[0]('SUBSCRIBED')); await settle()
  for (let round = 0; round < 4; round++) {
    const reads = 2 + round // initial list, join, then one repair per cooldown
    await act(async () => {
      for (let i = 0; i < 80; i++) {
        mockListeners[0]({ eventType: 'INSERT', new: row('overlapping') })
        mockListeners[0]({ eventType: 'DELETE', old: { id: 'server-only' } })
      }
      snapshot.resolve(result('server-only'))
    }); await settle()
    expect(screen.getByTestId('robots')).toHaveTextContent('"all":["server-only"]')
    await advance(999)
    act(() => mockListeners[0]({ eventType: 'INSERT', new: row('live') })); await settle()
    expect(screen.getByTestId('robots')).toHaveTextContent('"all":["live","server-only"]')
    expect(mockRobots).toHaveBeenCalledTimes(reads)
    snapshot = deferred<ReturnType<typeof result>>()
    mockRobots.mockReturnValueOnce(snapshot.promise)
    await advance(1)
    expect(mockRobots).toHaveBeenCalledTimes(reads + 1)
  }
  await act(async () => { snapshot.resolve(result('final')) }); await settle()
  await advance(5000)
  expect(screen.getByTestId('robots')).toHaveTextContent('"all":["final"]')
  expect(mockRobots).toHaveBeenCalledTimes(6)
})

it('takes a post-join snapshot when the SDK rejoins during an older read', async () => {
  mount(); await settle()
  const pending = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(pending.promise).mockResolvedValue(result('post-join'))
  act(() => mockStatuses[0]('SUBSCRIBED')); await settle()
  act(() => {
    mockListeners[0]({ eventType: 'INSERT', new: row('before-gap') })
    mockStatuses[0]('CLOSED'); mockStatuses[0]('SUBSCRIBED')
  })
  expect(mockRobots).toHaveBeenCalledTimes(2)
  await act(async () => { pending.resolve(result('before-gap')) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('"all":["post-join"]')
  await advance(2000); expect(mockRobots).toHaveBeenCalledTimes(3)
})

it.each(['hidden', 'actor', 'site', 'permission', 'route', 'unmount'])(
  'retires a scheduled repair and ignores late callbacks on %s', async reason => {
    const view = mount(); await settle()
    const pending = deferred<ReturnType<typeof result>>()
    mockRobots.mockReturnValueOnce(pending.promise)
    act(() => mockStatuses[0]('SUBSCRIBED')); await settle()
    await act(async () => {
      mockListeners[0]({ eventType: 'INSERT', new: row('overlap') })
      pending.resolve(result('previous'))
    }); await settle()
    expect(mockRobots).toHaveBeenCalledTimes(2)
    mockRobots.mockResolvedValue(result('new-generation'))
    if (reason === 'hidden') await visibility('hidden')
    if (reason === 'unmount') view.unmount()
    if (reason === 'actor') { mockActor = 'actor-b'; view.change() }
    if (reason === 'site') { mockSite = 'site-b'; view.change() }
    if (reason === 'permission') { mockRestricted = true; await focus() }
    if (reason === 'route') { mockPath = '/orders'; view.change() }
    await settle()
    const newGeneration = ['actor', 'site', 'permission'].includes(reason)
    act(() => {
      mockListeners[0]({ eventType: 'INSERT', new: row('retired') })
      mockStatuses[0]('SUBSCRIBED')
    })
    await advance(2000)
    expect(mockRobots).toHaveBeenCalledTimes(newGeneration ? 3 : 2)
    if (newGeneration) expect(screen.getByTestId('robots')).toHaveTextContent('"all":["new-generation"]')
    if (reason === 'route') expectEmpty()
    if (reason === 'hidden') expect(screen.getByTestId('robots')).toHaveTextContent('"all":["previous"]')
  },
)

it('recovers on wake even when the join stalls, then reconciles again after the join', async () => {
  mount(); await settle()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  await act(async () => { window.dispatchEvent(new Event('offline')) })
  await visibility('visible'); expect(mockTopics).toHaveLength(1)
  expect(mockRemoveChannel).toHaveBeenCalledTimes(1)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  await act(async () => { window.dispatchEvent(new Event('online')) })
  expect(mockTopics).toHaveLength(2)
  mockRobots.mockResolvedValue(result('without-socket'))
  await act(async () => { jest.advanceTimersByTime(1000) }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('without-socket')
  mockRobots.mockResolvedValue(result('after-slow-join'))
  await act(async () => { mockStatuses[1]('SUBSCRIBED') }); await settle()
  expect(screen.getByTestId('robots')).toHaveTextContent('after-slow-join')
})

it('resumes only the current authorized route, site and actor after switching while hidden', async () => {
  const view = mount(); await settle(); await visibility('hidden')
  mockSite = 'site-b'; mockActor = 'actor-b'; mockPath = '/orders'
  view.change(); await settle(); expectEmpty()
  await visibility('visible'); expect(mockTopics).toHaveLength(1)
  await visibility('hidden'); mockPath = '/robots'; view.change(); await settle()
  expect(mockTopics).toHaveLength(1)
  mockStatus = 'rejected'
  await visibility('visible'); expectEmpty(); expect(mockTopics).toHaveLength(1)
  mockStatus = 'active'; mockRobots.mockResolvedValue(result('authorized-b'))
  await focus(); expect(mockTopics).toHaveLength(2)
  expect(mockTopics[1]).toContain('robots_context_site-b_actor-b_')
  act(() => mockListeners[0]({ eventType: 'INSERT', new: row('old-scope') }))
  await settle(); expect(screen.getByTestId('robots')).toHaveTextContent('authorized-b')
  expect(screen.getByTestId('robots')).not.toHaveTextContent('old-scope')
})

it('ignores an in-flight repair that settles after hiding and switching accounts', async () => {
  const view = mount(); await settle()
  const first = deferred<ReturnType<typeof result>>()
  const repair = deferred<ReturnType<typeof result>>()
  mockRobots.mockReturnValueOnce(first.promise).mockReturnValueOnce(repair.promise)
  act(() => mockStatuses[0]('SUBSCRIBED')); await settle()
  await act(async () => {
    mockListeners[0]({ eventType: 'UPDATE', new: row('previous') })
    first.resolve(result('previous'))
  }); await advance(1000)
  expect(mockRobots).toHaveBeenCalledTimes(3)
  // Both kinds of pending work must die with the channel.
  act(() => {
    mockListeners[0]({ eventType: 'INSERT', new: row('stale-event') })
    mockStatuses[0]('SUBSCRIBED')
  })
  await visibility('hidden')
  mockActor = 'actor-b'; view.change(); await settle(); expectEmpty()
  const proof = deferred<{ data: { user: { id: string } }; error: null }>()
  mockGetUser.mockReturnValueOnce(proof.promise)
  await visibility('visible')
  expect(mockTopics).toHaveLength(1)
  expect(mockRobots).toHaveBeenCalledTimes(3)
  mockRobots.mockResolvedValue(result('authorized-b'))
  await act(async () => { proof.resolve({ data: { user: { id: mockActor } }, error: null }) }); await settle()
  await act(async () => { repair.resolve(result('late-actor-a')) }); await advance(2000)
  expect(mockTopics).toHaveLength(2)
  expect(mockRobots).toHaveBeenCalledTimes(4)
  expect(screen.getByTestId('robots')).toHaveTextContent('"all":["authorized-b"]')
})

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