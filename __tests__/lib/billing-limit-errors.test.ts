import { billingLimitApiError, parseBillingLimitError } from '@/lib/billing-limit-errors'

describe('billing-limit-errors', () => {
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
