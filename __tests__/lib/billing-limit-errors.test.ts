import { BILLING_LIMIT_EVENT, BillingUpgradeRequired, billingLimitApiError, emitBillingLimit, isBillingUpgradeRequired, parseBillingLimitError, type BillingLimitPayload } from '@/lib/billing-limit-errors'

describe('billing-limit-errors', () => {
  const memberPayload: BillingLimitPayload = { kind: 'members', current: 5, limit: 5, siteId: '11111111-1111-4111-8111-111111111111', requiredPlan: 'foundry', canUpgrade: false }

  it('preserves the structured member license scope and upgrade permissions', () => {
    expect(parseBillingLimitError({ error: { code: 'MEMBER_LIMIT', ...memberPayload } })).toEqual(memberPayload)
    expect(parseBillingLimitError({ success: false, upgradeRequired: memberPayload })).toEqual(memberPayload)
  })

  it('shares typed upgrade errors and emits the exact payload for the global dialog', () => {
    const error = new BillingUpgradeRequired(memberPayload)
    expect(isBillingUpgradeRequired(error)).toBe(true)
    expect(isBillingUpgradeRequired(new Error('MEMBER_LIMIT'))).toBe(false)
    expect(parseBillingLimitError(error)).toBe(memberPayload)
    const listener = jest.fn()
    window.addEventListener(BILLING_LIMIT_EVENT, listener)
    emitBillingLimit(error.payload)
    expect(listener.mock.calls[0][0].detail).toBe(memberPayload)
    window.removeEventListener(BILLING_LIMIT_EVENT, listener)
  })

  it('never turns missing migrations or incomplete member errors into valid upgrade permissions', () => {
    expect(parseBillingLimitError('Member license RPC unavailable')).toBeNull()
    expect(parseBillingLimitError({ error: { code: 'MEMBER_LIMIT', current: 5, limit: 5 } })).toBeNull()
    expect(parseBillingLimitError({ error: { code: 'MEMBER_LIMIT', ...memberPayload, requiredPlan: 'invalid' } })).toBeNull()
  })
  it('parses structured account limit API errors', () => {
    const payload = parseBillingLimitError(billingLimitApiError('accounts', 4, 3))
    expect(payload).toEqual({
      kind: 'accounts',
      current: 4,
      limit: 3,
      message: 'Account limit reached (4/3). Upgrade plan or get an account add-on.',
    })
  })

  it('parses credit limit messages from API client errors', () => {
    expect(parseBillingLimitError({
      message: 'Insufficient credits to run this workflow',
      code: 'CREDIT_LIMIT',
      current: 0,
      limit: 5,
    })).toEqual({
      kind: 'credits',
      current: 0,
      limit: 5,
      message: 'Insufficient credits to run this workflow',
    })
  })

  it('returns null for unrelated errors', () => {
    expect(parseBillingLimitError({ message: 'Unauthorized' })).toBeNull()
    expect(parseBillingLimitError('Network error')).toBeNull()
  })
})
