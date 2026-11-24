import { StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { SWRConfig, unstable_serialize } from 'swr'
import { useConversationsList } from '@/app/hooks/useConversationsList'
import { getConversationPage, type ConversationPage } from '@/app/services/getConversations.client'

jest.mock('@/app/services/getConversations.client', () => ({ getConversationPage: jest.fn() }))
const read = jest.mocked(getConversationPage)
type Options = Parameters<typeof useConversationsList>[0]
const defaults: Options = { siteId: 'site-A', userId: 'actor-A', combinedFilter: 'all', debouncedSearchQuery: '' }
const row = (id: string) => ({ id, title: id, agentName: 'Agent', agentId: '', timestamp: new Date(0) })
const page = (id: string, hasMore = false, page = 1): ConversationPage => ({ items: [row(id)], hasMore, page })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (value: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function mount(initialProps = defaults, dedupingInterval = 0) {
  const cache = new Map()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode><SWRConfig value={{ provider: () => cache, keepPreviousData: true, dedupingInterval }}>{children}</SWRConfig></StrictMode>
  )
  return { ...renderHook(useConversationsList, { wrapper, initialProps }), cache }
}
const flush = (ms = 0) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })
beforeEach(() => { jest.useFakeTimers(); read.mockReset() })
afterEach(() => { jest.useRealTimers() })

it('requires a new confirmation when returning to a recently confirmed key', async () => {
  const retired = deferred<ConversationPage>()
  const revisit = deferred<ConversationPage>()
  read.mockResolvedValueOnce(page('A')).mockReturnValueOnce(retired.promise).mockReturnValueOnce(revisit.promise)
  const hook = mount(defaults, 2_000)
  await flush()
  expect(hook.result.current.hasConfirmedFirstPage).toBe(true)
  hook.rerender({ ...defaults, combinedFilter: 'assigned' })
  expect(hook.result.current.hasConfirmedFirstPage).toBe(false)
  hook.rerender(defaults)
  expect(hook.result.current.conversations[0].id).toBe('A')
  await act(async () => { retired.resolve(page('B')) })
  expect(hook.result.current.hasConfirmedFirstPage).toBe(false)
  expect(read).toHaveBeenCalledTimes(3)
  await act(async () => { revisit.resolve(page('A')) })
  expect(hook.result.current.hasConfirmedFirstPage).toBe(true)
})

it('requires a real-site actor, admits demo, and uses the exact actor/site/filter/search list key', async () => {
  read.mockResolvedValue(page('result'))
  const hook = mount({ ...defaults, userId: undefined })
  expect(hook.result.current.hasMore).toBe(false)
  expect(hook.result.current.hasEmptyResult).toBe(false)
  await act(async () => { await hook.result.current.loadMore(); await hook.result.current.refreshConversations() })
  expect(read).not.toHaveBeenCalled()
  hook.rerender({ ...defaults, combinedFilter: 'assigned', debouncedSearchQuery: 'client' })
  await flush()
  expect(read).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledWith(expect.objectContaining({ currentUserId: 'actor-A', siteId: 'site-A', assigneeFilter: 'assigned', searchQuery: 'client' }))
  expect([...hook.cache.keys()]).toContain(unstable_serialize(['conversations', 'site-A', 'assigned', 'client', 'actor-A']))
  hook.rerender({ ...defaults, userId: undefined, siteId: 'demo-shop' })
  await flush()
  expect(read).toHaveBeenCalledTimes(2)
  hook.rerender({ ...defaults, siteId: '' })
  expect(hook.result.current.conversations).toEqual([])
  expect(hook.result.current.hasMore).toBe(false)
  await flush()
  expect(read).toHaveBeenCalledTimes(2)
})

it('never paginates before page one, coalesces clicks and advances by the last successful raw page', async () => {
  const first = deferred<ConversationPage>()
  const second = deferred<ConversationPage>()
  read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValueOnce(page('last', false, 3))
  const hook = mount()
  await act(async () => { await hook.result.current.loadMore() })
  expect(hook.result.current.hasMore).toBe(false)
  expect(read).toHaveBeenCalledTimes(1)
  await act(async () => { first.resolve(page('first', true)) })
  expect(hook.result.current.hasMore).toBe(true)
  act(() => { void hook.result.current.loadMore(); void hook.result.current.loadMore() })
  expect(read).toHaveBeenCalledTimes(2)
  expect(hook.result.current.isLoadingMore).toBe(true)
  await act(async () => { second.resolve({ items: [row('first'), row('second'), row('second')], hasMore: true, page: 2 }) })
  expect(hook.result.current.conversations.map(r => r.id)).toEqual(['first', 'second'])
  // Neither merged row count nor local edits are evidence that the last page was full.
  act(() => hook.result.current.updateConversations(rows => rows.slice(1)))
  await act(async () => { await hook.result.current.loadMore() })
  expect(read.mock.calls.map(([options]) => options.page)).toEqual([1, 2, 3])
  expect(hook.result.current.conversations.map(r => r.id)).toEqual(['second', 'last'])
  expect(hook.result.current.hasMore).toBe(false)
})

it.each<Partial<Options>>([{ siteId: 'site-B' }, { userId: 'actor-B' }, { combinedFilter: 'replied' }, { debouncedSearchQuery: 'different' }])(
  'retires reads, pre-change callbacks and pagination before rendering another resource: %o', async patch => {
    const late = deferred<ConversationPage>()
    const fresh = deferred<ConversationPage>()
    read.mockResolvedValueOnce(page('private-A', true)).mockReturnValueOnce(late.promise).mockReturnValueOnce(fresh.promise)
    const hook = mount()
    await flush()
    const before = hook.result.current
    act(() => { void before.loadMore() })
    const signal = read.mock.calls[1][0].signal
    hook.rerender({ ...defaults, ...patch })
    expect(hook.result.current.conversations).toEqual([])
    expect(hook.result.current.hasMore).toBe(false)
    expect(signal?.aborted).toBe(true)
    await act(async () => { await before.loadMore(); await before.refreshConversations(); before.updateConversations(() => [row('stale edit')]) })
    await act(async () => { fresh.resolve(page('fresh')); late.resolve(page('late', true, 2)) })
    expect(hook.result.current.conversations.map(r => r.id)).toEqual(['fresh'])
    expect(hook.result.current.hasMore).toBe(false)
    expect(read).toHaveBeenCalledTimes(3)
  },
)

it('does not append a retired page on A -> B -> A, or after a refresh of A', async () => {
  const oldA = deferred<ConversationPage>()
  read.mockResolvedValueOnce(page('A', true)).mockReturnValueOnce(oldA.promise).mockResolvedValueOnce(page('B'))
    .mockResolvedValueOnce(page('new-A', true))
  const hook = mount()
  await flush()
  act(() => { void hook.result.current.loadMore() })
  hook.rerender({ ...defaults, siteId: 'site-B' })
  await flush()
  hook.rerender(defaults)
  await flush(20)
  expect(hook.result.current.conversations[0].id).toBe('new-A')
  await act(async () => { oldA.resolve(page('old-A-page', true, 2)) })
  const refreshing = deferred<ConversationPage>()
  const retired = deferred<ConversationPage>()
  read.mockReturnValueOnce(retired.promise).mockReturnValueOnce(refreshing.promise)
  act(() => { void hook.result.current.loadMore(); void hook.result.current.refreshConversations(); void hook.result.current.refreshConversations() })
  expect(read.mock.calls.map(([options]) => options.page)).toEqual([1, 2, 1, 1, 2, 1])
  await act(async () => { retired.reject({ status: 403 }); refreshing.resolve(page('updated-A')) })
  expect(hook.result.current.conversations.map(r => r.id)).toEqual(['updated-A'])
  expect(hook.result.current.terminalError).toBeUndefined()
})

it('Strict Mode shares the initial first page and aborts its transport on real retirement', async () => {
  const first = deferred<ConversationPage>()
  read.mockReturnValueOnce(first.promise).mockResolvedValueOnce(page('current'))
  const hook = mount()
  const signal = read.mock.calls[0][0].signal
  await flush()
  expect(read).toHaveBeenCalledTimes(1)
  expect(signal?.aborted).toBe(false)
  hook.rerender({ ...defaults, userId: 'next user' })
  await flush()
  expect(signal?.aborted).toBe(true)
  await act(async () => { first.resolve(page('retired')) })
  expect(hook.result.current.conversations.map(r => r.id)).toEqual(['current'])
})

it('quarantines prior rows on a terminal refresh; a later outage cannot resurrect them', async () => {
  read.mockResolvedValueOnce(page('private', true)).mockRejectedValueOnce({ code: '42501' })
    .mockResolvedValueOnce(page('unrelated')).mockRejectedValueOnce({ status: 503 })
  const hook = mount()
  await flush()
  await act(async () => { await hook.result.current.refreshConversations() })
  expect(hook.result.current.terminalError?.status).toBe(403)
  expect(hook.result.current.hasEmptyResult).toBe(false)
  expect(hook.result.current.conversations).toEqual([])
  await act(async () => { await hook.result.current.loadMore(); await hook.result.current.refreshConversations() })
  await flush(60_000)
  expect(read).toHaveBeenCalledTimes(2)
  hook.rerender({ ...defaults, debouncedSearchQuery: 'other' })
  await flush()
  hook.rerender(defaults)
  await flush(30)
  expect(hook.result.current.readError?.status).toBe(503)
  expect(hook.result.current.conversations).toEqual([])
  expect(hook.result.current.hasMore).toBe(false)
})

it('retires an in-flight page when the window becomes read-only; saved callbacks cannot schedule it again', async () => {
  const late = deferred<ConversationPage>()
  read.mockResolvedValueOnce(page('verified', true)).mockReturnValueOnce(late.promise)
  const hook = mount()
  await flush()
  const before = hook.result.current
  act(() => { void before.loadMore() })
  hook.rerender({ ...defaults, previewOnly: true })
  expect(read.mock.calls[1][0].signal?.aborted).toBe(true)
  expect(hook.result.current.hasMore).toBe(false)
  await act(async () => { await before.loadMore(); before.updateConversations(() => [row('bad')]); late.resolve(page('late', true, 2)) })
  expect(hook.result.current.conversations.map(r => r.id)).toEqual(['verified'])
  hook.rerender(defaults)
  expect(hook.result.current.isLoadingMore).toBe(false)
  expect(hook.result.current.hasMore).toBe(true)
  hook.unmount()
  await before.loadMore()
  expect(read).toHaveBeenCalledTimes(2)
})