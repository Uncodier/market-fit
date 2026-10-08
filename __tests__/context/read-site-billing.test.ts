import { readSiteBilling } from '@/app/context/read-site-billing'
import { ANNUAL_BILLING_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS, SITE_BILLING_READ_FIELDS } from '@/app/context/site-billing-data'

it.each(ANNUAL_BILLING_FIELDS)('retries only the known pending annual column %s', async field => {
  const row = { plan: 'foundry', credits_available: 12 }
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: { code: '42703', message: `column billing.${field} does not exist` } })
    .mockResolvedValueOnce({ data: row, error: null })
  expect(await readSiteBilling(read)).toEqual({ data: row, error: null })
  expect(read.mock.calls.map(call => call[0])).toEqual([SITE_BILLING_READ_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS])
})

it('accepts the PostgREST missing schema-cache column form', async () => {
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: {
    code: 'PGRST204', message: "Could not find the 'billing_interval' column of 'billing' in the schema cache",
  } }).mockResolvedValueOnce({ data: [], error: null })
  expect(await readSiteBilling(read)).toEqual({ data: [], error: null })
  expect(read).toHaveBeenCalledTimes(2)
})

it.each([
  { code: '42501', message: 'permission denied' },
  { code: '42703', message: 'column billing.plan_credits_available does not exist' },
  { code: '42703', message: 'Unexpected error mentioning billing_interval' },
  { code: 'PGRST000', message: 'Connection failed' },
])('does not hide non-rollout errors ($code/$message)', async error => {
  const read = jest.fn().mockResolvedValue({ data: null, error })
  expect(await readSiteBilling(read)).toEqual({ data: null, error })
  expect(read).toHaveBeenCalledTimes(1)
})

it('does not retry recursively or replace a failed legacy read with zero credits', async () => {
  const denied = { code: '42501', message: 'permission denied' }
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column billing.billing_interval does not exist' } })
    .mockResolvedValueOnce({ data: null, error: denied })
  expect(await readSiteBilling(read)).toEqual({ data: null, error: denied })
  expect(read).toHaveBeenCalledTimes(2)
})