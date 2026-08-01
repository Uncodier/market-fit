import { canCancelSubscription } from '../../app/buyer/subscription-utils'

describe('canCancelSubscription', () => {
  const MOCK_NOW = new Date('2026-07-29T12:00:00Z').getTime()

  it('allows cancellation if status is active and no end_date', () => {
    const sub = { status: 'active', end_date: null }
    expect(canCancelSubscription(sub, MOCK_NOW)).toBe(true)
  })

  it('allows cancellation if status is paused and no end_date', () => {
    const sub = { status: 'paused', end_date: null }
    expect(canCancelSubscription(sub, MOCK_NOW)).toBe(true)
  })

  it('prevents cancellation if status is not active or paused', () => {
    expect(canCancelSubscription({ status: 'cancelled', end_date: null }, MOCK_NOW)).toBe(false)
    expect(canCancelSubscription({ status: 'expired', end_date: null }, MOCK_NOW)).toBe(false)
  })

  it('allows cancellation if end_date has already passed', () => {
    // Passed 1 month ago
    const sub = { status: 'active', end_date: '2026-06-29T12:00:00Z' }
    expect(canCancelSubscription(sub, MOCK_NOW)).toBe(true)
  })

  it('allows cancellation if end_date is exactly now', () => {
    const sub = { status: 'active', end_date: '2026-07-29T12:00:00Z' }
    expect(canCancelSubscription(sub, MOCK_NOW)).toBe(true)
  })

  it('prevents cancellation if end_date is in the future', () => {
    // Future 1 month from now
    const sub = { status: 'active', end_date: '2026-08-29T12:00:00Z' }
    expect(canCancelSubscription(sub, MOCK_NOW)).toBe(false)
  })

  it('handles invalid date strings by defaulting to allowing cancellation', () => {
    const sub = { status: 'active', end_date: 'invalid-date-string' }
    expect(canCancelSubscription(sub, MOCK_NOW)).toBe(true)
  })
})
