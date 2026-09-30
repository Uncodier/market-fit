import { createManualJournalEntry, updateManualJournalEntry, deleteManualJournalEntry } from '@/app/accounting/entries'
import { requireAccountingAccess } from '@/app/accounting/access'

jest.mock('server-only', () => ({}))
jest.mock('@/app/accounting/access', () => ({ requireAccountingAccess: jest.fn() }))
const siteId = '11111111-1111-4111-8111-111111111111'
const entryId = '22222222-2222-4222-8222-222222222222'
const payload = { entryDate: '2026-09-29', currency: 'USD', memo: 'Test',
  lines: [{ accountCode: '1000', debit: 100, credit: 0 }, { accountCode: '3000', debit: 0, credit: 100 }] }

describe('atomic journal actions', () => {
  let client: any
  beforeEach(() => {
    jest.clearAllMocks()
    const query: any = { select: jest.fn(() => query), eq: jest.fn(() => query),
      single: jest.fn(async () => ({ data: { source_type: 'manual', idempotency_key: `manual:${entryId}`, currency: 'USD' } })) }
    client = { from: jest.fn(() => query), rpc: jest.fn(async () => ({ data: entryId, error: null })) }
    jest.mocked(requireAccountingAccess).mockResolvedValue(client)
  })
  it('creates with one transactional RPC and never writes header/lines individually', async () => {
    await expect(createManualJournalEntry(siteId, payload)).resolves.toBe(entryId)
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, 'insert')
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).toHaveBeenCalledWith('accounting_save_journal', expect.objectContaining({
      p_site_id: siteId, p_entry: expect.objectContaining({ source_type: 'manual', currency: 'USD' }),
      p_lines: expect.arrayContaining([expect.objectContaining({ account_code: '1000', debit: 100 })]),
    }))
  })
  it('rejects malformed entries before any write', async () => {
    await expect(createManualJournalEntry(siteId, { ...payload, lines: [payload.lines[0]] })).rejects.toThrow()
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('enforces optimistic version and preserves currency', async () => {
    await expect(updateManualJournalEntry(siteId, entryId, payload)).rejects.toThrow('Reload')
    await expect(updateManualJournalEntry(siteId, entryId, { ...payload, currency: 'EUR', expectedHash: 'old' })).rejects.toThrow('currency')
    await updateManualJournalEntry(siteId, entryId, { ...payload, expectedHash: 'old' })
    expect(client.rpc).toHaveBeenCalledWith('accounting_save_journal', expect.objectContaining({
      p_entry_id: entryId, p_expected_hash: 'old', p_check_version: true,
    }))
  })
  it('does not compensate a failed atomic save with destructive separate deletes', async () => {
    client.rpc.mockResolvedValue({ error: { code: '40001' } })
    await expect(updateManualJournalEntry(siteId, entryId, { ...payload, expectedHash: 'old' })).rejects.toThrow('changed')
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('journal_entries')
  })
  it('authorizes deletion and delegates source-type checks to the atomic RPC', async () => {
    await deleteManualJournalEntry(siteId, entryId)
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, 'delete')
    expect(client.rpc).toHaveBeenCalledWith('accounting_delete_manual_journal', { p_site_id: siteId, p_entry_id: entryId })
  })
  it('never invokes storage when access is denied', async () => {
    jest.mocked(requireAccountingAccess).mockRejectedValue(new Error('Forbidden'))
    await expect(createManualJournalEntry(siteId, payload)).rejects.toThrow('Forbidden')
    expect(client.rpc).not.toHaveBeenCalled()
  })
})