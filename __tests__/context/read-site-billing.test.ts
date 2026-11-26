import { readSiteBilling } from '@/app/context/read-site-billing'
import { effectiveBillingPlan } from '@/lib/billing/startup-trial'
import { canConnectSocialAccount, getRequiredAddons } from '@/lib/billing-limits'
import { ANNUAL_BILLING_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS, SITE_BILLING_READ_FIELDS, TRIAL_BILLING_FIELDS, PRE_TRIAL_SITE_BILLING_READ_FIELDS, hydrateSiteBilling } from '@/app/context/site-billing-data'

it.each(ANNUAL_BILLING_FIELDS)('retries only the known pending annual column %s', async field => {
  const row = { plan: 'foundry', credits_available: 12 }
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: { code: '42703', message: `column billing.${field} does not exist` } })
    .mockResolvedValueOnce({ data: row, error: null })
  expect(await readSiteBilling(read)).toEqual({ data: row, error: null })
  expect(read.mock.calls.map(call => call[0])).toEqual([SITE_BILLING_READ_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS])
})

it.each(TRIAL_BILLING_FIELDS)('missing trial column %s preserves base billing without granting a trial', async field => {
  const row = { plan: 'commission' as const, credits_available: 1 }
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: { code: '42703', message: `column billing.${field} does not exist` } })
    .mockResolvedValueOnce({ data: row, error: null })
  expect(await readSiteBilling(read)).toEqual({ data: row, error: null })
  expect(read.mock.calls.map(call => call[0])).toEqual([SITE_BILLING_READ_FIELDS, PRE_TRIAL_SITE_BILLING_READ_FIELDS])
  expect(hydrateSiteBilling(row).trial_started_at).toBeUndefined()
})

it('handles both pending trial and annual schemas with bounded fallback reads', async () => {
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column billing.trial_started_at does not exist' } })
    .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column billing.billing_interval does not exist' } })
    .mockResolvedValueOnce({ data: { plan: 'commission' }, error: null })
  expect(await readSiteBilling(read)).toEqual({ data: { plan: 'commission' }, error: null })
  expect(read.mock.calls.map(call => call[0])).toEqual([SITE_BILLING_READ_FIELDS, PRE_TRIAL_SITE_BILLING_READ_FIELDS, LEGACY_SITE_BILLING_READ_FIELDS])
})

it('hydrates trial fields without converting the paid base plan', () => {
  expect(hydrateSiteBilling({ plan: 'commission', trial_started_at: '2026-10-19T12:00:00Z',
    trial_ends_at: '2026-11-03T12:00:00Z', trial_converted_at: null, trial_credits_available: 50 }))
    .toMatchObject({ plan: 'commission', trial_started_at: '2026-10-19T12:00:00Z', trial_credits_available: 50 })
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

it('preserves base balances before the temporary license projection rolls out', async () => {
  const row = { plan: 'commission' as const, credits_available: 0 }
  const read = jest.fn().mockResolvedValueOnce({ data: null, error: {
    code: '42703', message: 'column billing.temporary_workspace_license does not exist',
  } }).mockResolvedValueOnce({ data: row, error: null })
  expect(await readSiteBilling(read)).toEqual({ data: row, error: null })
  expect(read.mock.calls[1][0]).not.toContain('temporary_workspace_license')
})

it('uses the approved tier for connections until expiry without changing credits or the base plan', () => {
  const ends = '2090-12-25T00:05:11Z'
  const billing = hydrateSiteBilling({ plan: 'commission', credits_available: 0,
    temporary_workspace_license: { plan: 'foundry', ends_at: ends } })
  const site = { billing, settings: { social_media: [{ isActive: true }, { isActive: true }] } } as Parameters<typeof getRequiredAddons>[0]
  expect(effectiveBillingPlan(billing)).toBe('foundry')
  expect(getRequiredAddons(site)).toBe(0)
  expect(canConnectSocialAccount(site)).toBe(true)
  expect(effectiveBillingPlan(billing, Date.parse(ends))).toBe('commission')
  expect(getRequiredAddons(site, Date.parse(ends))).toBe(1)
  expect(billing).toMatchObject({ plan: 'commission', credits_available: 0 })
})

it('does not fall back to a stale paid tier on grace expiry or deny an unexpired paid period', () => {
  const start = Date.parse('2026-11-01T00:00:00Z')
  const end = Date.parse('2026-12-01T00:00:00Z')
  const billing = { plan: 'foundry', subscription_status: 'past_due',
    paid_subscription_period_start: new Date(start).toISOString(), paid_subscription_period_end: new Date(end).toISOString() }
  expect(effectiveBillingPlan(billing, end - 1)).toBe('foundry')
  expect(effectiveBillingPlan(billing, end)).toBe('commission')
  const expires = end + 120 * 3600_000
  const granted = { ...billing, temporary_workspace_license: {
    kind: 'emergency_grace', plan: 'foundry', ends_at: new Date(expires).toISOString(),
  } }
  expect(effectiveBillingPlan(granted, expires - 1)).toBe('foundry')
  expect(effectiveBillingPlan(granted, expires)).toBe('commission')
})