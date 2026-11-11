import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AutomationSnoozeControls } from '@/app/components/chat/AutomationSnoozeControls'
import { AutomationPausedBadge } from '@/app/components/chat/AutomationPausedBadge'

const state = { automation_paused_until: '2026-11-11T18:00:00Z', last_human_reply_at: '2026-11-11T14:00:00Z', automation_snooze_hours: null as number | null }
const mutate = jest.fn()
const mutateCache = jest.fn()
const update = jest.fn()
const hook = jest.fn()
jest.mock('@/app/hooks/useAutomationSnooze', () => ({ useAutomationSnooze: (...args: unknown[]) => hook(...args) }))
jest.mock('@/app/chat/automation-snooze-actions', () => ({ updateConversationAutomationSnooze: (...args: unknown[]) => update(...args) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'user-1' } }) }))
jest.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mutateCache }) }))

beforeEach(() => {
  jest.clearAllMocks()
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })
  jest.useFakeTimers().setSystemTime(new Date('2026-11-11T14:00:00Z'))
  hook.mockReturnValue({ data: state, mutate })
  update.mockResolvedValue({ data: state })
})
afterEach(() => jest.useRealTimers())

function open() {
  render(<AutomationSnoozeControls conversationId="conversation-1" siteId="site-1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Automation snooze settings' }))
}

it('shows a visible paused-until badge and expires it without another DB event', () => {
  const until = '2026-11-11T14:00:01Z'
  render(<AutomationPausedBadge until={until} />)
  expect(screen.getByText('Paused until')).toBeInTheDocument()
  expect(document.querySelector('time')).toHaveAttribute('datetime', until)
  act(() => jest.advanceTimersByTime(1002))
  expect(screen.queryByText('Paused until')).not.toBeInTheDocument()
})

it('defaults to four hours and allows fractional hours, disabled and default settings', async () => {
  open()
  const input = screen.getByRole('spinbutton', { name: 'Pause after a human reply (hours)' })
  expect(input).toHaveAttribute('placeholder', 'Default (4 hours)')
  for (const [value, hours] of [['0.5', 0.5], ['0', 0], ['', null]] as const) {
    fireEvent.change(input, { target: { value } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save hours' })) })
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('conversation-1', 'site-1', { action: 'settings', hours }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save hours' })).not.toBeDisabled())
  }
  expect(mutate).toHaveBeenCalledTimes(3)
  expect(mutateCache).toHaveBeenCalledTimes(3)
})

it('validates bounds and resumes with the observed timestamp only', async () => {
  open()
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '169' } })
  expect(screen.getByRole('button', { name: 'Save hours' })).toBeDisabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume now' })) })
  await waitFor(() => expect(update).toHaveBeenCalledWith('conversation-1', 'site-1', { action: 'resume', expectedPausedUntil: state.automation_paused_until }))
})

it('shows save errors without optimistic resume and supports retry', async () => {
  update.mockResolvedValue({ error: 'The conversation changed. Refresh and try again.' })
  open()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume now' })) })
  expect(await screen.findByRole('alert')).toHaveTextContent('conversation changed')
  expect(screen.getAllByText('Paused until')).toHaveLength(2)
  expect(mutateCache).not.toHaveBeenCalled()
})

it('keeps read failures distinct from disabled or active automation', () => {
  hook.mockReturnValue({ error: new Error('Unavailable'), mutate })
  open()
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load')
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(mutate).toHaveBeenCalled()
})