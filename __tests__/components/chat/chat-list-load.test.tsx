import { StrictMode, type ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { ChatList } from '@/app/components/chat/chat-list'
import { SWRProvider } from '@/app/providers/swr-provider'
import { getConversationPage, type ConversationPage } from '@/app/services/getConversations.client'
import { createClient } from '@/lib/supabase/client'
import { LocalizationProvider } from '@/app/context/LocalizationContext'

jest.mock('@/app/services/getConversations.client', () => ({ getConversationPage: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
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
function mount(previewOnly = false) {
  const select = jest.fn()
  const registerRefresh = jest.fn<void, [() => Promise<void>]>()
  const cache = new Map()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode><LocalizationProvider preferredLocale="en"><SWRProvider>
      <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
    </SWRProvider></LocalizationProvider></StrictMode>
  )
  const ui = (previewOnly: boolean) => <ChatList siteId="site" onSelectConversation={select}
    onLoadConversations={registerRefresh} previewOnly={previewOnly} />
  const view = render(ui(previewOnly), { wrapper })
  return { select, registerRefresh, setPreview: (value: boolean) => view.rerender(ui(value)) }
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