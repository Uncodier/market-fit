import { StrictMode, type ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { ChatList } from '@/app/components/chat/chat-list'
import ChatLoading from '@/app/chat/loading'
import { SWRProvider } from '@/app/providers/swr-provider'
import { createConversationListCache } from '@/app/providers/conversation-list-cache'
import { ConversationListCacheOnly } from '@/app/providers/conversation-list-read-scope'
import { WorkspaceSiteSWRScope } from '@/app/providers/WorkspaceSiteSWRScope'
import { getConversationPage, type ConversationPage } from '@/app/services/getConversations.client'
import { createClient } from '@/lib/supabase/client'
import { LocalizationProvider } from '@/app/context/LocalizationContext'

jest.mock('@/app/services/getConversations.client', () => ({ getConversationPage: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' }, isLoading: false }), useOptionalSite: () => null }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({
  user: { id: 'reviewer', user_metadata: { name: 'Reviewer', picture: '/local-avatar.png' } }, isLoading: false,
}) }))

const read = jest.mocked(getConversationPage)
const row = (id: string, status: 'active' | 'pending' = 'active') => ({ id, title: id, agentName: 'Agent', agentId: 'agent', status, timestamp: new Date(0) })
const first: ConversationPage = { items: [row('Loaded conversation', 'pending')], page: 1, hasMore: true }
const channel = { on: jest.fn(), subscribe: jest.fn() }
const openChannel = jest.fn(() => channel)
const from = jest.fn()
const flush = (ms = 0) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })
function mount(previewOnly = false, cacheConfig = createConversationListCache('reviewer', 'site'), cacheOnly = false) {
  const select = jest.fn()
  const registerRefresh = jest.fn<void, [() => Promise<void>]>()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode><LocalizationProvider preferredLocale="en"><SWRProvider>
      <WorkspaceSiteSWRScope><SWRConfig value={cacheConfig}>{children}</SWRConfig></WorkspaceSiteSWRScope>
    </SWRProvider></LocalizationProvider></StrictMode>
  )
  const ui = (previewOnly: boolean) => <ConversationListCacheOnly.Provider value={cacheOnly && previewOnly}>
    <ChatList siteId="site" onSelectConversation={select} onLoadConversations={registerRefresh} previewOnly={previewOnly} />
  </ConversationListCacheOnly.Provider>
  const view = render(ui(previewOnly), { wrapper })
  return { select, registerRefresh, unmount: view.unmount, setPreview: (value: boolean) => view.rerender(ui(value)) }
}
async function priorVisit() {
  const cache = createConversationListCache('reviewer', 'site')
  read.mockResolvedValueOnce(first)
  const visit = mount(false, cache)
  await flush()
  expect(visit.select).toHaveBeenCalledTimes(1)
  visit.unmount()
  read.mockClear()
  return cache
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  read.mockReset()
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  jest.mocked(createClient).mockReturnValue({ from, channel: openChannel, removeChannel: jest.fn() } as ReturnType<typeof createClient>)
})
afterEach(() => { jest.useRealTimers() })

it('matches the shared header divider beneath the search input', () => {
  mount()
  const header = screen.getByPlaceholderText('Search conversations...').closest('[class~="h-[71px]"]')

  expect(header).toHaveClass('border-b', 'border-black/5', 'dark:border-white/5')
})

it('keeps the same search header divider during route loading', () => {
  render(<ChatLoading />)
  const header = screen.getByRole('status', { name: 'Loading conversations' })
    .querySelector('[aria-hidden="true"] [class~="h-[71px]"]')

  expect(header).toHaveClass('border-b', 'border-black/5', 'dark:border-white/5')
})

it('keeps standard row spacing when the list transitions from loading to loaded', async () => {
  read.mockResolvedValueOnce({ ...first, items: [row('Standard conversation')] })
  mount()
  const skeleton = screen.getByRole('status', { name: 'Loading conversations' })
  const spacings = ['box-border w-full py-3 px-4 border-b', 'min-h-5 mb-1', 'min-h-4', 'min-h-4 mt-0.5 gap-2 leading-4']
  const placeholder = skeleton.querySelector('.box-border')!
  expect(placeholder).toHaveClass(spacings[0])
  Array.from(placeholder.children).forEach((slot, index) => expect(slot).toHaveClass(spacings[index + 1]))
  expect(skeleton.querySelector('[class~="h-[71px]"], [class~="h-[56px]"]')).toBeNull()

  await flush()
  const loaded = screen.getByText('Standard conversation').closest('.box-border')!
  expect(loaded).toHaveClass(spacings[0])
  Array.from(loaded.firstElementChild!.children).forEach((slot, index) => expect(slot).toHaveClass(spacings[index + 1]))
  expect(screen.queryByRole('status', { name: 'Loading conversations' })).not.toBeInTheDocument()
})

it.each(['Refreshed conversation', 'Loaded conversation'])('only auto-opens the confirmed first page: %s', async title => {
  const cache = await priorVisit()
  let finish!: (page: ConversationPage) => void
  read.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = mount(false, cache)
  expect(screen.getByText('Loaded conversation')).toBeVisible()
  await flush(50)
  expect(read).toHaveBeenCalledTimes(1)
  expect(read.mock.calls[0][0].page).toBe(1)
  expect(view.select).not.toHaveBeenCalled()

  // Includes a deep-equal response: SWR can keep the original items reference.
  await act(async () => { finish({ ...first, items: [row(title, 'pending')] }) })
  expect(view.select.mock.calls).toEqual([[title, 'Agent', 'agent', title]])
})

it.each([false, true])('does not open warm rows after failure or while retrying (denied: %s)', async denied => {
  const cache = await priorVisit()
  let finish!: (page: ConversationPage) => void
  let fail!: (cause: unknown) => void
  read.mockRejectedValueOnce({ status: 503 }).mockReturnValueOnce(new Promise((resolve, reject) => {
    finish = resolve; fail = reject
  }))
  const view = mount(false, cache)
  await flush(50)
  expect(screen.getByText('Loaded conversation')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(view.select).not.toHaveBeenCalled()
  await act(async () => { if (denied) fail({ status: 403 }); else finish(first) })
  if (denied) {
    expect(screen.queryByText('Loaded conversation')).not.toBeInTheDocument()
    expect(view.select).not.toHaveBeenCalled()
  } else {
    expect(view.select.mock.calls).toEqual([['Loaded conversation', 'Agent', 'agent', 'Loaded conversation']])
  }
  expect(read).toHaveBeenCalledTimes(2)
})

it('shows a cache-only revisit without a read, then waits for the resumed page before opening a thread', async () => {
  const cache = await priorVisit()
  let finish!: (page: ConversationPage) => void
  read.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = mount(true, cache, true)
  await flush(50)
  expect(screen.getByText('Loaded conversation')).toBeVisible()
  expect(read).not.toHaveBeenCalled()
  view.setPreview(false)
  await flush(50)
  expect(read).toHaveBeenCalledTimes(1)
  expect(view.select).not.toHaveBeenCalled()
  await act(async () => { finish({ ...first, items: [row('Resumed')] }) })
  expect(view.select.mock.calls).toEqual([['Resumed', 'Agent', 'agent', 'Resumed']])
})

it('distinguishes first load, failure and confirmed empty; clicking Retry starts just one fresh read', async () => {
  let fail!: (reason: unknown) => void
  let recover!: (page: ConversationPage) => void
  read.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject }))
    .mockReturnValueOnce(new Promise(resolve => { recover = resolve }))
  mount()
  expect(screen.getByRole('status', { name: 'Loading conversations' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument()
  expect(screen.queryByText('No conversations')).not.toBeInTheDocument()
  await act(async () => { fail({ status: 503, message: 'private gateway detail' }) })
  expect(screen.getByRole('alert')).toHaveTextContent('Conversations could not be loaded')
  expect(screen.queryByText(/private gateway detail|No conversations/)).not.toBeInTheDocument()
  fireEvent.focus(window)
  window.dispatchEvent(new Event('online'))
  await flush(60_000)
  expect(read).toHaveBeenCalledTimes(1)
  const retry = screen.getByRole('button', { name: 'Retry' })
  fireEvent.click(retry)
  expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  fireEvent.click(retry)
  await act(async () => { recover({ items: [], hasMore: false, page: 1 }) })
  expect(screen.getByText('No conversations')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument()
  expect(read).toHaveBeenCalledTimes(2)
})

it('keeps rows on transient refresh, hides them on terminal denial and stops retries and actions', async () => {
  read.mockResolvedValueOnce(first).mockRejectedValueOnce({ status: 503 }).mockRejectedValueOnce({ code: '42501' })
  const view = mount()
  await flush()
  const refresh = view.registerRefresh.mock.calls.at(-1)![0]
  expect(screen.getByRole('button', { name: 'Accept All' })).toBeVisible()
  await act(async () => { await refresh() })
  expect(screen.getByRole('alert')).toHaveTextContent('Showing the last loaded list')
  expect(screen.getByText('Loaded conversation')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Accept All' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent('Check your account and workspace access')
  expect(screen.queryByText('Loaded conversation')).not.toBeInTheDocument()
  expect(screen.queryByText('No conversations')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Retry|Load More/ })).not.toBeInTheDocument()
  await act(async () => { await refresh() })
  await flush(60_000)
  expect(read).toHaveBeenCalledTimes(3)
})

it('shows a page-specific retry without losing rows and retries the same page, never restarting page one', async () => {
  read.mockResolvedValueOnce(first).mockRejectedValueOnce({ status: 429 })
    .mockResolvedValueOnce({ items: [row('Older conversation')], page: 2, hasMore: false })
  mount()
  await flush()
  fireEvent.click(screen.getByRole('button', { name: 'Load More' }))
  await flush(60_000)
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load more conversations')
  expect(screen.getByText('Loaded conversation')).toBeVisible()
  expect(read).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading more' }))
  await flush()
  expect(read.mock.calls.map(([options]) => options.page)).toEqual([1, 2, 2])
  expect(screen.getByText('Older conversation')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument()
})

it('retires even the first page when a later page denies access', async () => {
  read.mockResolvedValueOnce(first).mockRejectedValueOnce({ status: 401 })
  mount()
  await flush()
  fireEvent.click(screen.getByRole('button', { name: 'Load More' }))
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent('Check your account and workspace access')
  expect(screen.queryByText('Loaded conversation')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Retry|Load More|More options|Accept All/ })).not.toBeInTheDocument()
})

it('hides the old search during debounce and requests only the last typed query', async () => {
  read.mockResolvedValueOnce(first).mockResolvedValueOnce({ items: [row('New match')], page: 1, hasMore: false })
  mount()
  await flush()
  const input = screen.getByPlaceholderText('Search conversations...')
  fireEvent.change(input, { target: { value: 'new' } })
  expect(screen.queryByText('Loaded conversation')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument()
  fireEvent.change(input, { target: { value: 'new match ' } })
  await flush(299)
  expect(read).toHaveBeenCalledTimes(1)
  await flush(1)
  expect(screen.getByText('New match')).toBeVisible()
  expect(read.mock.calls.map(([options]) => options.searchQuery)).toEqual(['', 'new match'])
})

it('renders provisional rows only: no independent profile query, realtime, actions, paging or navigation', async () => {
  read.mockResolvedValue(first)
  const view = mount(true)
  await flush()
  expect(screen.getByText('Loaded conversation')).toBeVisible()
  expect(screen.getByRole('tab', { name: 'Assigned' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /Accept All|Reject All|More options|Load More/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Loaded conversation'))
  expect(view.select).not.toHaveBeenCalled()
  expect(openChannel).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
  expect(view.registerRefresh).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  view.setPreview(false)
  expect(screen.getByRole('button', { name: 'Accept All' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'More options' })).toBeVisible()
  expect(view.select).toHaveBeenCalledWith('Loaded conversation', 'Agent', 'agent', 'Loaded conversation')
  expect(openChannel).toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
  expect(read).toHaveBeenCalledTimes(1)
})