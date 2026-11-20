import { act, renderHook } from '@testing-library/react'
import { useBillingCheck } from '@/app/hooks/use-billing-check'
import { usePeoplePageState } from '@/app/people/use-people-page-state'

let mockSite: { id: string; billing_read_status: string; billing: Record<string, unknown> } | null
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/BillingLimitContext', () => ({ useBillingLimit: () => ({ showBillingLimit: jest.fn() }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/hooks/use-mobile-view', () => ({ useIsMobile: () => false }))
jest.mock('@/app/people/use-saved-finder-lists', () => ({ useSavedFinderLists: () => ({ lists: [] }) }))
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))

beforeEach(() => {
  mockSite = { id: 'site', billing_read_status: 'loaded', billing: {
    plan: 'commission', credits_available: 0, account_balance: 2,
  } }
})

afterEach(() => jest.useRealTimers())

it.each([[0, 2, 2], [0.4, 0.6, 1], [2, null, 2], [2, -1, 1]])(
  'admits regular %s plus wallet %s without granting a paid plan', (regular, wallet, total) => {
    if (!mockSite) throw new Error('Missing billing fixture')
    mockSite.billing.credits_available = regular
    mockSite.billing.account_balance = wallet
    expect(renderHook(useBillingCheck).result.current).toMatchObject({
      canStartRobot: true, hasActiveCredits: true, hasEnginePlan: false, creditsAvailable: total,
    })
  },
)

it.each([[0, 0], [1, -2], [1, -1]])('blocks insufficient aggregate %s + %s', (regular, wallet) => {
  if (!mockSite) throw new Error('Missing billing fixture')
  mockSite.billing.credits_available = regular
  mockSite.billing.account_balance = wallet
  expect(renderHook(useBillingCheck).result.current).toMatchObject({ canStartRobot: false, hasActiveCredits: false })
})

it.each([undefined, NaN, Infinity, -Infinity, '20', true])('fails closed on invalid wallet %p even on a paid plan', wallet => {
  if (!mockSite) throw new Error('Missing billing fixture')
  mockSite.billing = { plan: 'engine', credits_available: 100, account_balance: wallet }
  expect(renderHook(useBillingCheck).result.current).toMatchObject({
    canStartRobot: false, hasActiveCredits: false, creditsAvailable: 0,
  })
})

it.each(['unavailable', 'missing'])('does not admit from stale context when the read is %s', status => {
  if (!mockSite) throw new Error('Missing billing fixture')
  mockSite.billing_read_status = status
  expect(renderHook(useBillingCheck).result.current).toMatchObject({ canStartRobot: false, creditsAvailable: 0 })
})

it('preserves the existing paid-plan admission branch but not when billing is absent', () => {
  if (!mockSite) throw new Error('Missing billing fixture')
  mockSite.billing = { plan: 'foundry', credits_available: 0, account_balance: 0 }
  const { result, rerender } = renderHook(useBillingCheck)
  expect(result.current).toMatchObject({ canStartRobot: true, hasEnginePlan: true, hasActiveCredits: false })
  mockSite = null
  rerender()
  expect(result.current).toMatchObject({ canStartRobot: false, creditsAvailable: 0 })
})

it.each([
  ['trial_credits_available', 'trial_started_at', 'trial_ends_at'],
  ['plan_credits_available', 'plan_credit_period_start', 'plan_credit_period_end'],
])('rechecks %s at expiry without requiring a balance refresh', (amount, start, end) => {
  if (!mockSite) throw new Error('Missing billing fixture')
  jest.useFakeTimers().setSystemTime(new Date('2026-11-15T23:59:59Z'))
  mockSite.billing = { plan: 'commission', credits_available: 5, account_balance: 0,
    [amount]: 5, [start]: '2026-11-01T00:00:00Z', [end]: '2026-11-16T00:00:00Z' }
  const { result, rerender } = renderHook(useBillingCheck)
  expect(result.current.creditsAvailable).toBe(5)
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current).toMatchObject({ creditsAvailable: 0, canStartRobot: false })
  mockSite.billing.account_balance = 2
  rerender()
  expect(result.current).toMatchObject({ creditsAvailable: 2, canStartRobot: true, hasEnginePlan: false })
})

it('updates the People import affordability gate using combined spendable credits', () => {
  if (!mockSite) throw new Error('Missing billing fixture')
  const { result, rerender } = renderHook(() => usePeoplePageState('search', jest.fn()))
  act(() => result.current.setTotalResults(10))
  const required = result.current.requiredCredits
  expect(required).toBeGreaterThan(0)
  mockSite.billing = { plan: 'commission', credits_available: 0, account_balance: required }
  rerender()
  expect(result.current.hasEnoughCredits).toBe(true)
  mockSite.billing = { plan: 'commission', credits_available: required / 2, account_balance: required / 2 }
  rerender()
  expect(result.current.hasEnoughCredits).toBe(true)
  mockSite.billing.account_balance = 0
  rerender()
  expect(result.current.hasEnoughCredits).toBe(false)
  mockSite.billing.account_balance = Infinity
  rerender()
  expect(result.current.hasEnoughCredits).toBe(false)
})

it('rechecks an earlier paid coverage expiry without granting paid entitlements from the wallet', () => {
  if (!mockSite) throw new Error('Missing billing fixture')
  jest.useFakeTimers().setSystemTime(new Date('2026-11-15T23:59:59Z'))
  mockSite.billing = { plan: 'commission', credits_available: 5, account_balance: 0,
    plan_credits_available: 5, plan_credit_period_start: '2026-11-01T00:00:00Z',
    plan_credit_period_end: '2026-12-01T00:00:00Z', paid_subscription_period_end: '2026-11-16T00:00:00Z' }
  const { result } = renderHook(useBillingCheck)
  expect(result.current.creditsAvailable).toBe(5)
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current).toMatchObject({ creditsAvailable: 0, canStartRobot: false, hasEnginePlan: false })
})