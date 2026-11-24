import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import NotificationsPage from '@/app/notifications/page'
import { NotificationCard } from '@/app/notifications/components/NotificationCard'
import { useNotifications } from '@/app/notifications/context/NotificationsContext'
import { Notification } from '@/app/notifications/types'

jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/notifications/context/NotificationsContext', () => ({ useNotifications: jest.fn() }))
jest.mock('@/app/components/ui/sticky-header', () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <header data-toolbar-icon-actions="">{children}</header>,
}))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => ({
    'notifications.tabs.all': 'All', 'notifications.tabs.unread': 'Unread',
    'notifications.markAllRead': 'Mark all as read', 'notifications.deleteAll': 'Delete all',
    'notifications.searchPlaceholder': 'Search notifications', 'notifications.empty.title': 'No notifications',
    'notifications.empty.search': 'No matching notifications',
  }[key] || key) }),
}))

const notification: Notification = {
  id: 'notification-1', title: 'Weekly summary', message: 'Review this week’s progress. '.repeat(20),
  type: 'info', is_read: false, site_id: 'site-1', user_id: 'user-1',
  created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z',
}

const makeContext = () => ({
  notifications: [notification, { ...notification, id: 'notification-2', title: 'Already reviewed', is_read: true }],
  status: 'ready' as ReturnType<typeof useNotifications>['status'], filters: {}, searchQuery: '', updateFilters: jest.fn(), updateSearchQuery: jest.fn(),
  clearFilters: jest.fn(), markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllNotificationsAsRead: jest.fn().mockResolvedValue(undefined),
  deleteOneNotification: jest.fn().mockResolvedValue(undefined),
  deleteAllUserNotifications: jest.fn().mockResolvedValue(undefined), refreshNotifications: jest.fn(),
})

describe('notification reading and actions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('expands the full message without marking it read or navigating', () => {
    const onMarkAsRead = jest.fn()
    render(<NotificationCard notification={notification} onMarkAsRead={onMarkAsRead} onDelete={jest.fn()} />)
    const expand = screen.getByRole('button', { name: 'Read more' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(expand)
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(expand.getAttribute('aria-controls')!)?.textContent).toBe(notification.message)
    expect(onMarkAsRead).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getByRole('button', { name: 'Read more' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps named actions visible and prevents duplicate clicks while saving', async () => {
    let finish!: () => void
    const onMarkAsRead = jest.fn(() => new Promise<void>(resolve => { finish = resolve }))
    render(<NotificationCard notification={notification} onMarkAsRead={onMarkAsRead} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }))
    expect(screen.getByRole('button', { name: 'Marking as read…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete notification' })).toBeDisabled()
    expect(onMarkAsRead).toHaveBeenCalledWith(notification.id)
    await act(async () => finish())
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeEnabled()
  })

  it('offers keyboard-accessible task navigation and does not turn reading into navigation', async () => {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
    const onMarkAsRead = jest.fn().mockResolvedValue(undefined)
    render(<NotificationCard notification={{ ...notification, related_entity_type: 'task', related_entity_id: 'task-1' }} onMarkAsRead={onMarkAsRead} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByRole('heading', { name: notification.title }))
    expect(push).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Go to task' })))
    expect(push).toHaveBeenCalledWith('/control-center/task-1')
    expect(onMarkAsRead).toHaveBeenCalledWith(notification.id)
  })

  it('does not offer expansion for short messages or read actions for read notifications', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined)
    render(<NotificationCard notification={{ ...notification, message: 'Done', is_read: true, created_at: 'invalid' }} onMarkAsRead={jest.fn()} onDelete={onDelete} />)
    expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as read' })).not.toBeInTheDocument()
    expect(screen.getByText('Date unavailable')).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete notification' })))
    expect(onDelete).toHaveBeenCalledWith(notification.id)
  })

  it.each([
    ['conversation', 'Go to chat', '/chat?conversationId=item-1'],
    ['task', 'Go to task', '/control-center/item-1'],
    ['instance', 'Go to instance', '/robots?instance=item-1'],
    ['lead', 'Go to lead', '/leads/item-1'],
    ['site', 'Go to projects', '/projects'],
    ['campaign', 'Go to campaign', '/campaigns/item-1'],
    ['content', 'Go to content', '/content/item-1'],
    ['requirement', 'Go to requirement', '/requirements/item-1'],
    ['segment', 'Go to segment', '/segments/item-1'],
  ])('offers a named CTA for %s and preserves full message expansion', async (type, label, href) => {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
    const onMarkAsRead = jest.fn().mockResolvedValue(undefined)
    render(<NotificationCard notification={{ ...notification, related_entity_type: type, related_entity_id: 'item-1' }} onMarkAsRead={onMarkAsRead} onDelete={jest.fn()} />)
    const expand = screen.getByRole('button', { name: 'Read more' })
    expect(document.getElementById(expand.getAttribute('aria-controls')!)?.textContent).toBe(`${notification.message.slice(0, 240).trimEnd()}…`)
    fireEvent.click(expand)
    expect(document.getElementById(expand.getAttribute('aria-controls')!)?.textContent).toBe(notification.message)
    expect(screen.queryByText('item-1')).not.toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(onMarkAsRead).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: label })))
    expect(push).toHaveBeenCalledWith(href)
    expect(onMarkAsRead).toHaveBeenCalledWith(notification.id)
  })

  it('opens an existing safe action URL without marking an already read notification', () => {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
    const onMarkAsRead = jest.fn()
    render(<NotificationCard notification={{ ...notification, is_read: true, action_url: '/billing' }} onMarkAsRead={onMarkAsRead} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))
    expect(push).toHaveBeenCalledWith('/billing')
    expect(onMarkAsRead).not.toHaveBeenCalled()
  })

  it.each([
    { related_entity_type: 'unknown', related_entity_id: 'item-1' },
    { related_entity_type: 'lead' },
    { action_url: '//outside.invalid' },
  ])('omits navigation for unsupported or incomplete targets: %j', target => {
    render(<NotificationCard notification={{ ...notification, ...target }} onMarkAsRead={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.queryByRole('button', { name: /^Go to/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument()
  })

  it('disables related navigation while notification actions are disabled', () => {
    const push = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
    render(<NotificationCard notification={{ ...notification, related_entity_type: 'instance', related_entity_id: 'item-1' }} onMarkAsRead={jest.fn()} onDelete={jest.fn()} disabled />)
    const button = screen.getByRole('button', { name: 'Go to instance' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(push).not.toHaveBeenCalled()
  })
})

describe('notification inbox toolbar', () => {
  let context: ReturnType<typeof makeContext>
  beforeEach(() => {
    context = makeContext()
    jest.mocked(useNotifications).mockReturnValue(context)
  })

  it('preserves the bulk label and explicit icons inside the automatic toolbar', async () => {
    render(<NotificationsPage />)
    const read = screen.getByRole('button', { name: 'Mark all as read' })
    expect(read).toHaveTextContent('Mark all as read')
    expect(read.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Delete all' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('searchbox', { name: 'Search notifications' })).toBeVisible()
    await act(async () => fireEvent.click(read))
    expect(context.markAllNotificationsAsRead).toHaveBeenCalledTimes(1)
  })

  it('requires confirmation before deleting all, and allows cancellation', async () => {
    render(<NotificationsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
    expect(context.deleteAllUserNotifications).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(context.deleteAllUserNotifications).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
    await act(async () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete all notifications' })))
    expect(context.deleteAllUserNotifications).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('filters unread items and passes search changes to the provider', () => {
    render(<NotificationsPage />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Unread/ }), { button: 0, ctrlKey: false })
    expect(context.updateFilters).toHaveBeenCalledWith({ is_read: false })
    expect(screen.queryByRole('heading', { name: 'Already reviewed' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'weekly' } })
    expect(context.updateSearchQuery).toHaveBeenCalledWith('weekly')
  })

  it('groups search with the segment bar and keeps bulk actions separate', () => {
    render(<NotificationsPage />)
    const segments = screen.getByRole('tablist', { name: 'Filter notifications' })
    const filterGroup = segments.parentElement!.parentElement!
    expect(filterGroup).toContainElement(screen.getByRole('searchbox', { name: 'Search notifications' }))
    expect(filterGroup).not.toContainElement(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(filterGroup).not.toContainElement(screen.getByRole('button', { name: 'Delete all' }))
  })

  it('uses the shared expandable search with its keyboard shortcut', async () => {
    render(<NotificationsPage />)
    const input = screen.getByRole('searchbox', { name: 'Search notifications' })
    expect(input).toHaveAttribute('data-command-k-input', 'true')
    expect(screen.getByTitle('Search notifications')).toBeInTheDocument()
    expect(screen.getByText('K', { selector: 'kbd' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await waitFor(() => expect(input).toHaveFocus())
    expect(input.closest('.origin-right')).toHaveClass('opacity-100')
  })

  it('clears a query using the shared search control', () => {
    context.searchQuery = 'weekly'
    render(<NotificationsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(context.updateSearchQuery).toHaveBeenCalledWith('')
  })

  it('shows search recovery without changing the bulk action scope', () => {
    context.searchQuery = 'no match'
    render(<NotificationsPage />)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete all' })).toBeEnabled()
    fireEvent.click(screen.getByText('Clear search', { selector: 'button' }))
    expect(context.updateSearchQuery).toHaveBeenCalledWith('')
  })

  it('only mounts the skeleton while loading', () => {
    context.status = 'loading'
    const { container } = render(<NotificationsPage />)
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
  })
})