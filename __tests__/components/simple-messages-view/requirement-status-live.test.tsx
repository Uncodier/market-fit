import { renderHook, render, screen } from '@testing-library/react'
import useSWR from 'swr'
import { useRequirementStatus } from '@/app/components/simple-messages-view/hooks/useRequirementStatus'
import { RequirementStatusCard } from '@/app/components/simple-messages-view/components/RequirementStatusCard'
import { subscribeRequirementStatusRealtime, subscribeRequirementExecutionRealtime } from '@/app/components/simple-messages-view/hooks/subscribeRequirementStatusRealtime'

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/hooks/subscribeRequirementStatusRealtime', () => ({ subscribeRequirementStatusRealtime: jest.fn(() => jest.fn()), subscribeRequirementExecutionRealtime: jest.fn(() => jest.fn()) }))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

describe('requirement live state', () => {
  const mutate = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSWR as jest.Mock).mockReturnValue({ data: [{ requirement_id: 'req-1', stage: 'blocked' }], mutate })
  })

  it('subscribes to the requirement itself, not just append-only status history', () => {
    const hook = renderHook(() => useRequirementStatus({ id: 'instance-1' }))
    expect(subscribeRequirementStatusRealtime).toHaveBeenCalledWith('instance-1')
    expect(subscribeRequirementExecutionRealtime).toHaveBeenCalledWith('instance-1', 'req-1')
    expect((useSWR as jest.Mock).mock.calls[0][2]).toEqual(expect.objectContaining({ keepPreviousData: false }))
    hook.unmount()
    expect((subscribeRequirementExecutionRealtime as jest.Mock).mock.results[0].value).toHaveBeenCalledTimes(1)
  })

  it('renders the technical blocker visibly rather than a running indicator', () => {
    render(<RequirementStatusCard status={{ stage: 'blocked', message: 'Migration 0016 requires technical review. No customer approval is needed.' }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Requirement · blocked')
    expect(screen.getByRole('status')).toHaveTextContent('Migration 0016 requires technical review')
  })
})