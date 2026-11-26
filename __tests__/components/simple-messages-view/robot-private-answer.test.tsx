import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'
import { RobotAnswerBody } from '@/app/components/simple-messages-view/components/RobotAnswerBody'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: ReactNode }) => <p>{children}</p> }))
jest.mock('remark-gfm', () => jest.fn())
jest.mock('remark-breaks', () => jest.fn())

const owner = 'cb87227f-5895-44c8-9600-e3a27bc23d89'
const action = '833f6a34-278f-4a9d-9abe-936ef348d629'
const receipt = (id = action): InstanceLog => ({
  id: 'response', created_at: '', level: 'info', log_type: 'agent_action', user_id: owner, parent_log_id: id,
  details: { response_type: 'assistant_response', user_log_id: id },
  message: `This answer uses private connector data. [Open your answer](/robots/private-answer/${id}).`,
})
function view(log: InstanceLog, id: string | null = owner, anonymous = false, loading = false) {
  const auth = { user: id ? { id, is_anonymous: anonymous } : null, isLoading: loading } as AuthContextValue
  return <AuthContext.Provider value={auth}><RobotAnswerBody log={log} /></AuthContext.Provider>
}
const frame = () => screen.queryByTitle('Private Ask answer')

it('renders a linked Records answer inline for its owner without trusting the marker as authorization', () => {
  const log = receipt()
  log.message = log.message.replace('connector data', 'workspace data')
  const { rerender } = render(view(log))
  expect(frame()).toHaveAttribute('src', `/robots/private-answer/${action}/inline`)
  rerender(view(log, 'other'))
  expect(frame()).toBeNull()
})

it('does not navigate to the private route for another viewer, a loading session, or anonymous user', () => {
  const { rerender } = render(view(receipt(), null))
  for (const element of [view(receipt(), 'other'), view(receipt(), owner, true), view(receipt(), owner, false, true)]) {
    rerender(element)
    expect(frame()).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/private to the person/)).toBeVisible()
  }
})

it('detaches pending or displayed answers across account and action changes; refresh uses a new frame', () => {
  jest.useFakeTimers()
  try {
    const { rerender } = render(view(receipt()))
    const first = frame()!
    expect(first).toHaveAttribute('src', `/robots/private-answer/${action}/inline`)
    expect(first.getAttribute('sandbox')).not.toMatch(/allow-scripts|allow-same-origin/)
    rerender(view(receipt(), 'other'))
    act(() => { first.dispatchEvent(new Event('load')) })
    expect(frame()).toBeNull()
    expect(first.isConnected).toBe(false)
    rerender(view(receipt()))
    const second = frame()!
    expect(second).not.toBe(first)
    rerender(view(receipt(owner)))
    expect(second.isConnected).toBe(false)
    const third = frame()!
    expect(third).toHaveAttribute('src', `/robots/private-answer/${owner}/inline`)
    act(() => { jest.advanceTimersByTime(60_000) })
    expect(frame()).not.toBe(third)
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    expect(frame()).toBeNull()
    act(() => { window.dispatchEvent(new Event('pageshow')) })
    expect(frame()).not.toBeNull()
  } finally { jest.useRealTimers() }
})

it('does not hydrate arbitrary links or metadata as a private final answer', () => {
  const log = receipt()
  const { rerender } = render(view({ ...log, message: 'An ordinary answer' }))
  expect(screen.getByText('An ordinary answer')).toBeVisible()
  for (const change of [{ parent_log_id: owner }, { log_type: 'user_action' as const }, { details: {} }, { message: `${log.message} More text` }]) {
    rerender(view({ ...log, ...change }))
    expect(frame()).toBeNull()
  }
})