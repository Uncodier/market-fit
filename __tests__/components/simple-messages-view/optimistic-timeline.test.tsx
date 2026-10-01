import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { SimpleMessagesView } from '@/app/components/simple-messages-view'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

const toast = jest.fn()
const from = jest.fn()
const channel = jest.fn()
const router = { push: jest.fn(), replace: jest.fn() }
const searchParams = new URLSearchParams()

// Exercise the real view/model, composer, send path, log state and Realtime.
// Ancillary selectors/plans and external service boundaries are isolated here.
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/RobotsContext', () => ({ useRobots: () => ({ refreshRobots: jest.fn() }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'user' } }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }))
jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => searchParams, usePathname: () => '/robots' }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from, channel, removeChannel: jest.fn(), auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } }),
}))
jest.mock('@/app/services/context-service', () => ({ contextService: { getContextData: async () => ({ records: [] }) } }))
jest.mock('@/app/components/simple-messages-view/hooks/useUserProfile', () => ({ useUserProfile: () => ({ userProfile: { name: 'Test User' } }) }))
jest.mock('@/app/components/simple-messages-view/hooks/useInstancePlans', () => ({
  useInstancePlans: () => ({ steps: [], instancePlans: [], completedPlans: [], isLoadingPlans: false, areAllStepsCompleted: () => true }),
}))
jest.mock('@/app/components/simple-messages-view/hooks/useRequirementStatus', () => ({ useRequirementStatus: () => ({ requirementStatuses: [] }) }))
jest.mock('@/app/components/simple-messages-view/hooks/useInstanceAssets', () => ({ useInstanceAssets: () => ({ assets: [] }) }))
jest.mock('@/app/components/simple-messages-view/hooks/usePendingWork', () => ({ usePendingWork: () => ({ pendingWork: [] }) }))
jest.mock('@/app/components/simple-messages-view/hooks/use-live-instance-logs', () => ({ useLiveInstanceLogs: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/hooks/useAttachmentUpload', () => ({ useAttachmentUpload: () => ({ uploadFile: jest.fn(), isUploading: false }) }))
jest.mock('@/app/components/simple-messages-view/components/ActivitySelector', () => ({ ActivitySelector: () => null }))
jest.mock('@/app/components/simple-messages-view/components/SkillSelector', () => ({ SkillSelector: () => null }))
jest.mock('@/app/components/simple-messages-view/components/MediaParametersToolbar', () => ({ MediaParametersToolbar: () => null }))
jest.mock('@/app/components/simple-messages-view/components/InstanceContextUsage', () => ({ InstanceContextUsage: () => null }))
jest.mock('@/app/components/ui/context-selector-modal', () => ({ ContextSelectorModal: () => null }))
jest.mock('@/app/components/context/context-mention-picker', () => ({ ContextMentionPicker: () => null }))
jest.mock('@/app/records/response-record-actions', () => ({ syncAiFeedbackRecord: jest.fn(), createResponseRecord: jest.fn() }))
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('remark-breaks', () => ({ __esModule: true, default: jest.fn() }))

const originalResizeObserver = globalThis.ResizeObserver
beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})
afterEach(() => { globalThis.ResizeObserver = originalResizeObserver })

it.each([
  { outcome: 'confirmed', message: 'Show my message now' },
  { outcome: 'confirmed', message: '' },
  { outcome: 'confirmed', message: ' \n ' },
  { outcome: 'confirmed', message: null },
  { outcome: 'confirmed', message: undefined },
  { outcome: 'rejected', message: '' },
])('keeps the visible prompt through $outcome with persisted content $message', async ({ outcome, message }) => {
  let emit!: (payload: { eventType: 'INSERT' | 'UPDATE'; new: InstanceLog }) => void
  const subscription: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn((_event, _filter, callback) => { emit = callback; return subscription }),
    subscribe: jest.fn(callback => { callback('SUBSCRIBED'); return subscription }),
  }
  channel.mockReturnValue(subscription)
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  }
  from.mockImplementation(table => {
    if (table !== 'instance_logs') throw new Error(`Unexpected table: ${table}`)
    return query
  })
  let respond!: (response: Response) => void
  jest.mocked(fetch).mockImplementation(() => new Promise(resolve => { respond = resolve }))
  const { unmount } = render(<SWRConfig value={{ provider: () => new Map() }}>
    <SimpleMessagesView activeRobotInstance={{ id: 'instance', status: 'completed' }} />
  </SWRConfig>)
  const composer = await screen.findByRole('textbox')
  fireEvent.change(composer, { target: { value: 'Show my message now' } })
  fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

  expect(screen.getAllByText('Show my message now')).toHaveLength(1)
  expect(screen.getByText('Thinking')).toBeInTheDocument()
  expect(screen.queryByText('Running')).not.toBeInTheDocument()
  const preview = screen.getByText('Show my message now')
  const previewRow = preview.closest('[data-timeline-item-id]')
  const workflowMeta = screen.getByText('Sending').parentElement
  expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const [, options] = jest.mocked(fetch).mock.calls[0]
  const payload = JSON.parse(String(options?.body))
  expect(payload.request_id).toEqual(expect.any(String))

  const saved = {
    id: 'persisted-user-message', instance_id: 'instance', log_type: 'user_action', level: 'info',
    message, created_at: new Date().toISOString(),
    details: { request_id: payload.request_id, status: 'running', lifecycle_owner: 'api' },
  } as InstanceLog
  if (outcome === 'confirmed') {
    act(() => { emit({ eventType: 'INSERT', new: saved }) })
    expect(screen.getAllByText('Show my message now')).toHaveLength(1)
    expect(screen.getByText('Show my message now')).toBe(preview)
    expect(preview.closest('[data-timeline-item-id]')).toBe(previewRow)
    expect(screen.getByText('Running').parentElement).toBe(workflowMeta)
    expect(screen.getByTitle('Cancel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Latest' })).not.toBeInTheDocument()
  }
  await act(async () => { respond({
    ok: outcome === 'confirmed', status: outcome === 'confirmed' ? 200 : 409,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(outcome === 'confirmed' ? { success: true } : {
      success: false, execution_started: false,
      error: { code: 'ASSISTANT_EXECUTION_BUSY', message: 'This assistant execution is already in progress' },
    }),
  } as unknown as Response) })
  if (outcome === 'confirmed') {
    expect(composer).toHaveValue('')
    expect(screen.getAllByText('Show my message now')).toHaveLength(1)
    act(() => { emit({ eventType: 'UPDATE', new: { ...saved, message: '' } }) })
    expect(screen.getByText('Show my message now')).toBe(preview)
    expect(preview.closest('[data-timeline-item-id]')).toBe(previewRow)
  } else {
    expect(composer).toHaveValue('Show my message now')
    expect(screen.queryByText('Show my message now')).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Assistant is busy' }))
  }
  expect(screen.queryByText('Thinking')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
  unmount()
})