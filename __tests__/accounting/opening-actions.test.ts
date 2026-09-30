import { saveOpeningEntry, getOpeningEntry } from '@/app/accounting/chart'
import { requireAccountingAccess } from '@/app/accounting/access'

jest.mock('server-only', () => ({}))
jest.mock('@/app/accounting/access', () => ({ requireAccountingAccess: jest.fn() }))
const siteId = '11111111-1111-4111-8111-111111111111'
const entryId = '22222222-2222-4222-8222-222222222222'

describe('opening journal actions', () => {
  let client: any, readResult: any
  beforeEach(() => {
    jest.clearAllMocks()
    readResult = { data: { id: entryId, source_hash: 'old', currency: 'USD' }, error: null }
    const query: any = { select: () => query, eq: () => query, maybeSingle: async () => readResult }
    client = { from: jest.fn(() => query), rpc: jest.fn(async () => ({ data: entryId })) }
    jest.mocked(requireAccountingAccess).mockResolvedValue(client)
  })
  it('rejects empty replacement instead of erasing old balances', async () => {
    await expect(saveOpeningEntry(siteId, '2026-09-29', {}, 'USD', 'old')).rejects.toThrow()
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('requires initialized version and rejects stale edits', async () => {
    const balances = { '1000': { debit: 100, credit: 0 } }
    await expect(saveOpeningEntry(siteId, '2026-09-29', balances, 'USD')).rejects.toThrow('Load opening')
    await expect(saveOpeningEntry(siteId, '2026-09-29', balances, 'USD', 'stale')).rejects.toThrow('changed')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('atomically saves balances with calculated equity and unchanged currency', async () => {
    await saveOpeningEntry(siteId, '2026-09-29', { '1000': { debit: 100, credit: 0 } }, 'USD', 'old')
    expect(client.rpc).toHaveBeenCalledWith('accounting_save_journal', expect.objectContaining({
      p_entry_id: entryId, p_check_version: true, p_expected_hash: 'old',
      p_lines: expect.arrayContaining([expect.objectContaining({ account_code: '3000', credit: 100, debit: 0 })]),
    }))
  })
  it('surfaces load failures and never silently treats them as no opening entry', async () => {
    readResult = { data: null, error: { message: 'unavailable' } }
    await expect(getOpeningEntry(siteId)).rejects.toThrow('Unable to load')
    await expect(saveOpeningEntry(siteId, '2026-09-29', {}, 'USD', null)).rejects.toThrow('Unable to load')
    expect(client.rpc).not.toHaveBeenCalled()
  })
})