import '@testing-library/jest-dom'
import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { LeadAutomationSnoozeDialog } from '@/app/leads/components/LeadAutomationSnoozeDialog'
import { AutomationSnoozeStatus } from '@/app/components/chat/AutomationSnoozeStatus'
import { AutomationPausedBadge } from '@/app/components/chat/AutomationPausedBadge'

const thread = { id: 'conversation-1', automation_paused_until: '2026-11-11T18:00:00Z', last_human_reply_at: '2026-11-11T14:00:00Z' }
const data = { hours: null, siteHours: 4, effectiveHours: 4, conversations: [thread] }
const mutate = jest.fn()
const mutateCache = jest.fn()
const update = jest.fn()
const resume = jest.fn()
const hook = jest.fn()
function render(ui: ReactNode) {
  return rtlRender(ui, { wrapper: ({ children }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> })
}
jest.mock('@/app/leads/components/use-lead-automation-snooze', () => ({ useLeadAutomationSnooze: (...args: unknown[]) => hook(...args) }))
jest.mock('@/app/hooks/useAutomationSnooze', () => ({ useAutomationSnooze: () => ({ data: thread }) }))
jest.mock('@/app/leads/automation-snooze-actions', () => ({ updateLeadAutomationSnooze: (...args: unknown[]) => update(...args) }))
jest.mock('@/app/chat/automation-snooze-actions', () => ({ updateConversationAutomationSnooze: (...args: unknown[]) => resume(...args) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'user-1' } }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site-1' } }) }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => ({ can: () => true }) }))
jest.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mutateCache }) }))

beforeEach(() => {
  jest.clearAllMocks()
  global.ResizeObserver = jest.fn().mockImplementation(() => ({ observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() }))
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })
  jest.useFakeTimers().setSystemTime(new Date('2026-11-11T14:00:00Z'))
  hook.mockReturnValue({ data, mutate })
  update.mockResolvedValue({ data: { hours: null } })
  resume.mockResolvedValue({ data: thread })
})
afterEach(() => jest.useRealTimers())

function open() {
  return render(<LeadAutomationSnoozeDialog leadId="lead-1" leadName="Example lead" open onOpenChange={jest.fn()} />)
}

it('shows a paused-until badge and expires it without a DB event', () => {
  render(<AutomationPausedBadge until="2026-11-11T14:00:01Z" />)
  expect(screen.getByText('Paused until')).toBeInTheDocument()
  act(() => jest.advanceTimersByTime(1002))
  expect(screen.queryByText('Paused until')).not.toBeInTheDocument()
})

it('keeps header status read-only', () => {
  render(<AutomationSnoozeStatus conversationId="conversation-1" siteId="site-1" />)
  expect(screen.getByText('Paused until')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('inherits default four hours and saves off/custom/inherit for this lead only', async () => {
  open()
  expect(screen.getByRole('radio', { name: 'Inherit site setting (4 hours)' })).toBeChecked()
  expect(screen.getByText(/Existing pauses keep their expiry/)).toBeInTheDocument()
  for (const [label, hours] of [['Off for this lead', 0], ['Custom hours', 0.5], ['Inherit site setting (4 hours)', null]] as const) {
    fireEvent.click(screen.getByRole('radio', { name: label }))
    if (hours === 0.5) fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0.5' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save setting' })) })
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('lead-1', 'site-1', hours))
  }
  expect(resume).not.toHaveBeenCalled()
})

it('rejects custom zero and >168, and resumes per thread with BOTH observed timestamps', async () => {
  open()
  fireEvent.click(screen.getByRole('radio', { name: 'Custom hours' }))
  for (const value of ['0', '169', '']) {
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value } })
    expect(screen.getByRole('button', { name: 'Save setting' })).toBeDisabled()
  }
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume now' })) })
  expect(resume).toHaveBeenCalledWith('conversation-1', 'site-1', { action: 'resume', expectedPausedUntil: thread.automation_paused_until, expectedLastHumanReplyAt: thread.last_human_reply_at })
})

it('shows CAS errors without optimistic resume', async () => {
  resume.mockResolvedValue({ error: 'The conversation changed. Refresh and try again.' })
  open()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume now' })) })
  expect(await screen.findByRole('alert')).toHaveTextContent('conversation changed')
  expect(screen.getByText('Paused until')).toBeInTheDocument()
  expect(mutateCache).not.toHaveBeenCalled()
})

it('keeps read failures distinct from disabled or active automation', () => {
  hook.mockReturnValue({ error: new Error('Unavailable'), mutate })
  open()
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load')
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(mutate).toHaveBeenCalled()
})