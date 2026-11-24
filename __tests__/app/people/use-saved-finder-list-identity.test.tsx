import { act, cleanup, renderHook } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useSavedFinderLists } from '@/app/people/use-saved-finder-lists'
import { deferred } from './test-helpers'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

type Session = { user: { id: string } } | null
type Response = { data: unknown; error: unknown }
let authCallback: (event: string, session: Session) => void
const getSession = jest.fn()
const unsubscribe = jest.fn()
const order = jest.fn()
const eq = jest.fn().mockReturnThis()
const select = jest.fn().mockReturnThis()
const from = jest.fn(() => ({ select, eq, order }))
const session = (id: string): Session => ({ user: { id } })
const list = (id: string) => ({
  id, name: id, status: 'pending', role_query_id: 'query', total_targets: 1,
  processed_targets: 0, found_matches: 0, progress_percent: '0',
})
const response = (ids: string[]): Response => ({ data: ids.map(list), error: null })

async function flush() {
  await act(async () => { await Promise.resolve() })
}

async function runDeferredLoad() {
  await act(async () => { jest.advanceTimersByTime(0) })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  order.mockReset().mockResolvedValue(response(['actor-a-list']))
  getSession.mockReset().mockResolvedValue({ data: { session: session('actor-a') }, error: null })
  ;(createClient as jest.Mock).mockReturnValue({
    from,
    auth: {
      getSession,
      onAuthStateChange: jest.fn(callback => {
        authCallback = callback
        return { data: { subscription: { unsubscribe } } }
      }),
    },
  })
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('does not create a client or inspect auth while disabled', () => {
  ;(createClient as jest.Mock).mockReturnValue(undefined)
  const { result } = renderHook(() => useSavedFinderLists('site-a', false))
  expect(createClient).not.toHaveBeenCalled()
  expect(result.current).toMatchObject({ lists: [], loading: false, error: false })
})

it('invalidates same-site actor data synchronously and queries only after the auth callback', async () => {
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  expect(result.current.lists).toEqual([list('actor-a-list')])
  order.mockResolvedValue(response(['actor-b-list']))

  act(() => { authCallback('SIGNED_IN', session('actor-b')) })
  expect(result.current.lists).toEqual([])
  expect(result.current.loading).toBe(true)
  expect(order).toHaveBeenCalledTimes(1)
  await runDeferredLoad()
  expect(result.current.lists).toEqual([list('actor-b-list')])
  expect(eq.mock.calls).toEqual([['site_id', 'site-a'], ['site_id', 'site-a']])
  expect(select).toHaveBeenCalledWith('id, name, status, created_at, total_targets, role_query_id, processed_targets, found_matches, progress_percent')
})

it('rejects late actor responses even after switching back to the original actor', async () => {
  const late = deferred<Response>()
  order.mockReturnValueOnce(late.promise)
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  act(() => { authCallback('SIGNED_IN', session('actor-b')) })
  order.mockResolvedValue(response(['actor-b-list']))
  await runDeferredLoad()
  act(() => { authCallback('SIGNED_IN', session('actor-a')) })
  order.mockResolvedValue(response(['fresh-actor-a-list']))
  await runDeferredLoad()
  await act(async () => { late.resolve(response(['obsolete-actor-a-list'])) })
  expect(result.current.lists).toEqual([list('fresh-actor-a-list')])
})

it('clears logout data and rejects pending reads without querying anonymously', async () => {
  const late = deferred<Response>()
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  order.mockReturnValueOnce(late.promise)
  act(() => { result.current.refresh() })
  act(() => { authCallback('SIGNED_OUT', null) })
  expect(result.current).toMatchObject({ lists: [], loading: false, error: false })
  await act(async () => { late.resolve(response(['private-list'])) })
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('online'))
    jest.advanceTimersByTime(30_000)
  })
  expect(order).toHaveBeenCalledTimes(2)
  expect(result.current.lists).toEqual([])
})

it('rejects a late initial session after an auth event', async () => {
  const lateSession = deferred<{ data: { session: Session }; error: null }>()
  getSession.mockReturnValueOnce(lateSession.promise)
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  act(() => { authCallback('SIGNED_IN', session('actor-b')) })
  order.mockResolvedValue(response(['actor-b-list']))
  await runDeferredLoad()
  await act(async () => { lateSession.resolve({ data: { session: session('actor-a') }, error: null }) })
  expect(result.current.lists).toEqual([list('actor-b-list')])
  expect(order).toHaveBeenCalledTimes(1)
})

it('starts one RLS read if the initial session notification follows the same session lookup', async () => {
  const pending = deferred<Response>()
  order.mockReturnValueOnce(pending.promise)
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  act(() => { authCallback('INITIAL_SESSION', session('actor-a')) })
  await runDeferredLoad()
  expect(order).toHaveBeenCalledTimes(1)
  await act(async () => { pending.resolve(response(['allowed'])) })
  expect(result.current.lists).toEqual([list('allowed')])
})

it('settles an initial signed-out auth event without leaving the view loading', async () => {
  const lateSession = deferred<{ data: { session: Session }; error: null }>()
  getSession.mockReturnValueOnce(lateSession.promise)
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  act(() => { authCallback('INITIAL_SESSION', null) })
  expect(result.current).toMatchObject({ lists: [], loading: false, error: false })
  await act(async () => { lateSession.resolve({ data: { session: session('actor-a') }, error: null }) })
  expect(result.current).toMatchObject({ lists: [], loading: false, error: false })
  expect(order).not.toHaveBeenCalled()
})

it('invalidates repeated SIGNED_IN confirmations for permission freshness', async () => {
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  act(() => { authCallback('SIGNED_IN', session('actor-a')) })
  expect(result.current.lists).toEqual([])
  expect(order).toHaveBeenCalledTimes(1)
  order.mockResolvedValueOnce(response([]))
  await runDeferredLoad()
  expect(result.current).toMatchObject({ lists: [], loading: false, error: false })
  expect(order).toHaveBeenCalledTimes(2)
})

it.each(['focus', 'online', 'interval'])('re-reads RLS on %s to tighten same-actor permissions', async trigger => {
  const late = deferred<Response>()
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  order.mockReturnValueOnce(late.promise)
  act(() => {
    if (trigger === 'interval') jest.advanceTimersByTime(30_000)
    else window.dispatchEvent(new Event(trigger))
  })
  expect(result.current.lists).toEqual([])
  expect(result.current.loading).toBe(true)
  await act(async () => { late.resolve(response([])) })
  expect(result.current).toMatchObject({ lists: [], loading: false, error: false })
  expect(order).toHaveBeenCalledTimes(2)
})

it('keeps refresh failures distinct from successful empty reads and supports retry', async () => {
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  order.mockResolvedValueOnce({ data: null, error: { message: 'Permission read failed' } })
  act(() => { window.dispatchEvent(new Event('focus')) })
  await flush()
  expect(result.current).toMatchObject({ lists: [], loading: false, error: true })
  order.mockResolvedValueOnce(response(['still-authorized']))
  act(() => { result.current.refresh() })
  await flush()
  expect(result.current).toMatchObject({ lists: [list('still-authorized')], loading: false, error: false })
})

it('retains current data for normal same-user token refresh', async () => {
  const { result } = renderHook(() => useSavedFinderLists('site-a', true))
  await flush()
  act(() => { authCallback('TOKEN_REFRESHED', session('actor-a')) })
  await runDeferredLoad()
  expect(result.current.lists).toEqual([list('actor-a-list')])
  expect(order).toHaveBeenCalledTimes(1)
})

it('disposes subscriptions and ignores late responses when disabled or changing sites', async () => {
  const late = deferred<Response>()
  order.mockReturnValueOnce(late.promise)
  const { result, rerender } = renderHook(
    ({ siteId, enabled }) => useSavedFinderLists(siteId, enabled),
    { initialProps: { siteId: 'site-a', enabled: true } },
  )
  await flush()
  order.mockResolvedValueOnce(response(['site-b-list']))
  rerender({ siteId: 'site-b', enabled: true })
  await flush()
  await act(async () => { late.resolve(response(['site-a-list'])) })
  expect(result.current.lists).toEqual([list('site-b-list')])
  rerender({ siteId: 'site-b', enabled: false })
  expect(result.current.lists).toEqual([])
  expect(unsubscribe).toHaveBeenCalledTimes(2)
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
    jest.advanceTimersByTime(30_000)
  })
  expect(order).toHaveBeenCalledTimes(2)
})