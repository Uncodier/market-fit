import { postPeriodSyncSources, findPeriodSyncSources } from '@/app/accounting/period-sync'
import { loadPostingAccountMap, postSourceJournalWithClient } from '@/app/accounting/source-posting'
import { readAllAccountingRows } from '@/app/accounting/paging'
import { withSyncDeadline } from '@/app/accounting/sync-progress'
import type { SupabaseClient } from '@supabase/supabase-js'

jest.mock('server-only', () => ({}))
jest.mock('@/app/accounting/source-posting', () => ({
  loadPostingAccountMap: jest.fn(), postSourceJournalWithClient: jest.fn(),
  sourceTables: { sale: 'sales', expense: 'transactions', purchase: 'purchases' },
}))
jest.mock('@/app/accounting/paging', () => ({ readAllAccountingRows: jest.fn() }))

beforeEach(() => jest.resetAllMocks())

it('limits workers to four, shares one chart map, and attempts every source after failures', async () => {
  const accountCodes = new Map<string, string>()
  jest.mocked(loadPostingAccountMap).mockResolvedValue(accountCodes)
  let active = 0
  let max = 0
  jest.mocked(postSourceJournalWithClient).mockImplementation(async (_client, _type, id) => {
    active += 1
    max = Math.max(max, active)
    await new Promise(resolve => setTimeout(resolve, 1))
    active -= 1
    if (id === '3') throw new Error('invalid source')
  })
  const sources = Array.from({ length: 12 }, (_, id) => ({ type: 'sale' as const, id: String(id) }))
  expect(await postPeriodSyncSources({} as SupabaseClient, 'site', sources)).toEqual({ processed: 12, failed: 1 })
  expect(max).toBe(4)
  expect(loadPostingAccountMap).toHaveBeenCalledTimes(1)
  expect(postSourceJournalWithClient).toHaveBeenCalledTimes(12)
  expect(postSourceJournalWithClient).toHaveBeenCalledWith({}, 'sale', '11', 'site', { skipUnpublished: true, accountCodes })
})

it('does not initialize accounts for an empty period', async () => {
  expect(await postPeriodSyncSources({} as SupabaseClient, 'site', [])).toEqual({ processed: 0, failed: 0 })
  expect(loadPostingAccountMap).not.toHaveBeenCalled()
})

it('filters expenses on the server without dropping older sales with new receipts', async () => {
  const chain: Record<string, jest.Mock> = {}
  for (const method of ['select', 'eq', 'neq', 'order', 'or', 'gte', 'lt']) chain[method] = jest.fn(() => chain)
  jest.mocked(readAllAccountingRows).mockImplementation(async factory => {
    factory()
    return []
  })
  await findPeriodSyncSources({ from: () => chain } as unknown as SupabaseClient, 'site', '2026-09-01', '2026-09-30')
  expect(chain.or).toHaveBeenCalledTimes(1)
  expect(chain.or).toHaveBeenCalledWith('and(date.gte.2026-09-01,date.lt.2026-10-01),and(updated_at.gte.2026-09-01T00:00:00.000Z,updated_at.lt.2026-10-01T00:00:00.000Z)')
  expect(chain.eq).toHaveBeenCalledWith('site_id', 'site')
})

it('bounds an unresponsive request without automatically retrying it', async () => {
  jest.useFakeTimers()
  try {
    const pending = withSyncDeadline(new Promise<void>(() => {}))
    const assertion = expect(pending).rejects.toThrow('Some entries may have been saved')
    await jest.advanceTimersByTimeAsync(60_000)
    await assertion
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

it('clears the deadline on success and preserves ordinary errors', async () => {
  expect(await withSyncDeadline(Promise.resolve(42))).toBe(42)
  await expect(withSyncDeadline(Promise.reject(new Error('Forbidden')))).rejects.toThrow('Forbidden')
})