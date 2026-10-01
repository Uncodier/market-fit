import { currentRequirementPresentation } from '@/app/components/simple-messages-view/requirement-execution-state'

describe('current requirement execution presentation', () => {
  it('overrides stale in-progress history with the authoritative technical hold', () => {
    const result = currentRequirementPresentation({ stage: 'in-progress', message: 'Automatic retries remaining' }, {
      id: 'req', status: 'blocked', execution_hold: { kind: 'migration_platform_review', file: '0016.sql', reason: 'Budget exhausted' },
    })
    expect(result.stage).toBe('blocked')
    expect(result.message).toContain('0016.sql')
    expect(result.message).toContain('Budget exhausted')
    expect(result.message).not.toContain('Automatic retries remaining')
  })
  it('shows legacy blocked requirements even before the projection migration is applied', () => {
    const result = currentRequirementPresentation({ stage: 'in-progress' }, { id: 'req', status: 'blocked' })
    expect(result.stage).toBe('blocked')
    expect(result.message).toContain('no resumption is confirmed')
  })
  it('preserves a concrete blocked status message when no projection exists', () => {
    expect(currentRequirementPresentation({ stage: 'blocked', message: 'Storage capability unavailable' }, { id: 'req', status: 'blocked' }).message).toBe('Storage capability unavailable')
  })
  it('does not claim that eligibility means an executor is running', () => {
    const result = currentRequirementPresentation({ stage: 'blocked', message: 'Old hold' }, { id: 'req', status: 'in-progress' })
    expect(result.stage).toBe('in-progress')
    expect(result.message).toContain('has not been confirmed')
  })
})