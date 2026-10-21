import { StrictMode, useState } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useInstanceCreation } from '@/app/robots/use-instance-creation'

jest.mock('@/lib/supabase/client', () => ({ createClient: () => mockSupabase }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}
type Input = Parameters<typeof useInstanceCreation>[0]
const authResult = { data: { user: { id: 'user-a' } }, error: null }
const newInstance = { id: 'created-a', name: 'Assistant Session', site_id: 'site-a' }
const mockCheck = jest.fn()
const mockInsert = jest.fn()
const mockAvatar = jest.fn()
const mockGetUser = jest.fn()
const mockEq = jest.fn()
interface TestQuery {
  select: () => TestQuery
  eq: (key: string, value: string) => TestQuery
  like: () => TestQuery
  order: () => TestQuery
  limit: () => Promise<unknown>
  insert: (rows: unknown) => TestQuery
  single: () => Promise<unknown>
}
const mockSupabase = {
  auth: { getUser: mockGetUser },
  storage: { from: () => ({ getPublicUrl: (url: string) => ({ data: { publicUrl: `https://example.com/${url}` } }) }) },
  from: jest.fn((table: string) => {
    const query: TestQuery = {
      select: jest.fn(() => query),
      eq: jest.fn((key: string, value: string) => { mockEq(table, key, value); return query }),
      like: jest.fn(() => query), order: jest.fn(() => query),
      limit: jest.fn(() => table === 'assets' ? mockAvatar() : mockCheck()),
      insert: jest.fn((rows: unknown) => { mockInsert(rows); return query }),
      single: jest.fn(() => mockInsertResult()),
    }
    return query
  }),
}
const mockInsertResult = jest.fn()
function input(siteId = 'site-a', extra: object = {}): Input {
  return {
    allInstances: [], instanceAvatars: {}, setInstanceAvatars: jest.fn(),
    isSiteContextReady: true, refreshCount: 1, lastAutoCreationAttempt: 0,
    isLoadingRobots: false, currentSite: { id: siteId }, getAllInstances: jest.fn(() => []),
    shouldAutoConvertTab: false, pendingInstanceId: null, isAutoCreatingInstance: false,
    setIsAutoCreatingInstance: jest.fn(), setLastAutoCreationAttempt: jest.fn(),
    refreshRobots: jest.fn().mockResolvedValue(undefined), setLocalSelectedInstanceId: jest.fn(),
    setPendingInstanceId: jest.fn(), setShouldAutoConvertTab: jest.fn(),
    searchParams: new URLSearchParams('mode=agent&artifact=true&screen=orders&tab=preview'),
    router: { replace: jest.fn() }, activeRobotInstance: null, setIsResuming: jest.fn(),
    ...extra,
  } as unknown as Input
}
// Exercise the actual React setters and their rerenders, rather than replacing
// lifecycle state with spies that could conceal self-cancellation or loops.
function useStatefulCreation(base: Input) {
  const [isAutoCreatingInstance, setIsAutoCreatingInstance] = useState(false)
  const [lastAutoCreationAttempt, setLastAutoCreationAttempt] = useState(0)
  const [pendingInstanceId, setPendingInstanceId] = useState<string | null>(null)
  const [shouldAutoConvertTab, setShouldAutoConvertTab] = useState(false)
  const [localSelectedInstanceId, setLocalSelectedInstanceId] = useState<string | null>(null)
  const [instanceAvatars, setInstanceAvatars] = useState<Record<string, string>>({})
  const [isResuming, setIsResuming] = useState(false)
  return useInstanceCreation({
    ...base, isAutoCreatingInstance, setIsAutoCreatingInstance, lastAutoCreationAttempt,
    setLastAutoCreationAttempt, pendingInstanceId, setPendingInstanceId, shouldAutoConvertTab,
    setShouldAutoConvertTab, localSelectedInstanceId, setLocalSelectedInstanceId,
    instanceAvatars, setInstanceAvatars, isResuming, setIsResuming,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCheck.mockReset().mockResolvedValue({ data: [], error: null })
  mockGetUser.mockReset().mockResolvedValue(authResult)
  mockInsertResult.mockReset().mockResolvedValue({ data: newInstance, error: null })
  mockAvatar.mockReset().mockResolvedValue({ data: [], error: null })
})

describe('Robots creation asynchronous lifecycle', () => {
  it('creates once after database verification despite actual loading-state rerenders, then converts the pending tab', async () => {
    const base = input()
    const view = renderHook(useStatefulCreation, { initialProps: base })
    await waitFor(() => expect(base.router.replace).toHaveBeenCalledTimes(1))
    expect(mockCheck).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
      site_id: 'site-a', user_id: 'user-a', created_by: 'user-a', status: 'pending',
    })])
    expect(mockEq).toHaveBeenCalledWith('remote_instances', 'site_id', 'site-a')
    expect(base.refreshRobots).toHaveBeenCalledWith('site-a')
    expect(base.router.replace).toHaveBeenCalledWith('/robots?mode=agent&instance=created-a&name=Assistant+Session')
    expect(view.result.current.isAutoCreatingInstance).toBe(false)
    expect(view.result.current.pendingInstanceId).toBe('created-a')
    view.rerender({ ...base, allInstances: [newInstance] } as Input)
    expect(view.result.current.pendingInstanceId).toBeNull()
    expect(view.result.current.shouldAutoConvertTab).toBe(false)
    expect(view.result.current.localSelectedInstanceId).toBe('created-a')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    await act(async () => {})
  })

  it.each(['switch', 'unmount'])('does not create after a stale database check on %s', async transition => {
    const pending = deferred<{ data: unknown[]; error: null }>()
    mockCheck.mockReturnValue(pending.promise)
    const base = input()
    const view = renderHook(useInstanceCreation, { initialProps: base })
    expect(mockCheck).toHaveBeenCalledTimes(1)
    if (transition === 'switch') view.rerender(input('site-b', { isSiteContextReady: false }))
    else view.unmount()
    await act(async () => { pending.resolve({ data: [], error: null }) })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(base.setIsAutoCreatingInstance).not.toHaveBeenCalled()
    expect(base.router.replace).not.toHaveBeenCalled()
  })

  it.each(['switch', 'unmount', 'selection'])('does not insert after stale authentication on %s', async transition => {
    const auth = deferred<typeof authResult>()
    mockGetUser.mockReturnValue(auth.promise)
    const base = input()
    const view = renderHook(useInstanceCreation, { initialProps: base })
    await waitFor(() => expect(mockGetUser).toHaveBeenCalledTimes(1))
    if (transition === 'switch') view.rerender(input('site-b', { isSiteContextReady: false }))
    else if (transition === 'selection') view.rerender({ ...base, pendingInstanceId: 'chosen' } as Input)
    else view.unmount()
    await act(async () => { auth.resolve(authResult) })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(base.refreshRobots).not.toHaveBeenCalled()
    expect(base.router.replace).not.toHaveBeenCalled()
  })

  it.each(['insert', 'refresh'])('does not publish stale selection after site change during %s', async stage => {
    const insert = deferred<{ data: typeof newInstance; error: null }>()
    const refresh = deferred<void>()
    if (stage === 'insert') mockInsertResult.mockReturnValue(insert.promise)
    const base = input('site-a', {
      refreshRobots: jest.fn(() => stage === 'refresh' ? refresh.promise : Promise.resolve()),
    })
    const view = renderHook(useInstanceCreation, { initialProps: base })
    await waitFor(() => expect(stage === 'insert' ? mockInsert : base.refreshRobots).toHaveBeenCalledTimes(1))
    view.rerender(input('site-b', { isSiteContextReady: false }))
    await act(async () => { insert.resolve({ data: newInstance, error: null }); refresh.resolve() })
    expect(base.setLocalSelectedInstanceId).not.toHaveBeenCalled()
    expect(base.router.replace).not.toHaveBeenCalled()
    if (stage === 'insert') expect(base.refreshRobots).not.toHaveBeenCalled()
  })

  it('creates only for the new site when old and new checks finish out of order', async () => {
    const old = deferred<{ data: unknown[]; error: null }>()
    mockCheck.mockReturnValueOnce(old.promise).mockResolvedValue({ data: [], error: null })
    const a = input(), b = input('site-b')
    const view = renderHook(useInstanceCreation, { initialProps: a })
    view.rerender(b)
    await waitFor(() => expect(b.router.replace).toHaveBeenCalledTimes(1))
    await act(async () => { old.resolve({ data: [], error: null }) })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockInsert.mock.calls[0][0][0].site_id).toBe('site-b')
    expect(a.router.replace).not.toHaveBeenCalled()
  })

  it('StrictMode effect replay cancels the discarded request without duplicate inserts', async () => {
    const base = input()
    renderHook(useStatefulCreation, { initialProps: base, wrapper: StrictMode })
    await waitFor(() => expect(base.router.replace).toHaveBeenCalledTimes(1))
    expect(mockCheck).toHaveBeenCalledTimes(2)
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('fails closed on the database read error and does not create while debounce/eligibility changes', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockCheck.mockResolvedValue({ data: null, error: new Error('denied') })
    const base = input()
    const view = renderHook(useInstanceCreation, { initialProps: { ...base, lastAutoCreationAttempt: Date.now() } })
    expect(mockCheck).not.toHaveBeenCalled()
    view.rerender(base)
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    expect(mockInsert).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('guards button authentication and old button callbacks across site changes', async () => {
    const auth = deferred<typeof authResult>()
    mockGetUser.mockReturnValue(auth.promise)
    const base = input('site-a', { isSiteContextReady: false })
    const view = renderHook(useInstanceCreation, { initialProps: base })
    const oldHandler = view.result.current.handleCreateNewInstance
    let action!: Promise<void>
    act(() => { action = oldHandler() })
    view.rerender(input('site-b', { isSiteContextReady: false }))
    await act(async () => { auth.resolve(authResult); await action; await oldHandler() })
    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(base.router.replace).not.toHaveBeenCalled()
  })

  it('uses changed setter dependencies when converting a pending tab', () => {
    const base = input('site-a', { isSiteContextReady: false, pendingInstanceId: 'x', shouldAutoConvertTab: true })
    const view = renderHook(useInstanceCreation, { initialProps: base })
    const next = input('site-a', { ...base, setLocalSelectedInstanceId: jest.fn(), allInstances: [{ id: 'x' }] })
    view.rerender(next)
    expect(next.setLocalSelectedInstanceId).toHaveBeenCalledWith('x')
    expect(base.setLocalSelectedInstanceId).not.toHaveBeenCalled()
  })

  it('rebinds resume events to the new instance/setter and removes them on unmount', () => {
    const a = input('site-a', { isSiteContextReady: false, activeRobotInstance: { id: 'a', status: 'paused' } })
    const view = renderHook(useInstanceCreation, { initialProps: a })
    act(() => window.dispatchEvent(new CustomEvent('robot:resume-start', { detail: { instanceId: 'a' } })))
    expect(a.setIsResuming).toHaveBeenCalledWith(true)
    const b = input('site-a', { isSiteContextReady: false, activeRobotInstance: { id: 'b', status: 'paused' } })
    view.rerender(b)
    act(() => window.dispatchEvent(new CustomEvent('robot:resume-start', { detail: { instanceId: 'a' } })))
    expect(b.setIsResuming).not.toHaveBeenCalled()
    act(() => window.dispatchEvent(new CustomEvent('robot:resume-failed', { detail: { instanceId: 'b' } })))
    expect(b.setIsResuming).toHaveBeenCalledWith(false)
    view.unmount()
    act(() => window.dispatchEvent(new CustomEvent('robot:resume-start', { detail: { instanceId: 'b' } })))
    expect(b.setIsResuming).toHaveBeenCalledTimes(1)
  })

  it('writes completed avatar absence once and ignores old-site avatar responses', async () => {
    const avatars = deferred<{ data: Array<{ file_path: string }>; error: null }>()
    mockAvatar.mockReturnValue(avatars.promise)
    const base = input('site-a', { isSiteContextReady: false, allInstances: [{ id: 'a' }] })
    const view = renderHook(useInstanceCreation, { initialProps: base })
    expect(base.setInstanceAvatars).not.toHaveBeenCalled()
    view.rerender(input('site-b', { isSiteContextReady: false }))
    await act(async () => { avatars.resolve({ data: [{ file_path: 'old.png' }], error: null }) })
    expect(base.setInstanceAvatars).not.toHaveBeenCalled()
    mockAvatar.mockResolvedValue({ data: [], error: null })
    const stateful = renderHook(useStatefulCreation, { initialProps: base })
    await waitFor(() => expect(stateful.result.current.instanceAvatars).toEqual({ a: '' }))
    const count = mockAvatar.mock.calls.length
    stateful.rerender(base)
    expect(mockAvatar).toHaveBeenCalledTimes(count)
  })
})