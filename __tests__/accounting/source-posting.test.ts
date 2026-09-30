import { postSourceJournalWithClient, replaceSourceJournals } from '@/app/accounting/source-posting'
import { buildSaleJournalDrafts, buildFromExpense, buildPurchaseJournalDrafts } from '@/app/accounting/builders'
import { readAllAccountingRows } from '@/app/accounting/paging'
import { ensureChartWithClient, loadAccountsWithClient } from '@/app/accounting/chart-store'

jest.mock('server-only', () => ({}))
jest.mock('@/app/accounting/builders', () => ({ buildSaleJournalDrafts: jest.fn(), buildFromExpense: jest.fn(), buildPurchaseJournalDrafts: jest.fn() }))
jest.mock('@/app/accounting/chart-store', () => ({ ensureChartWithClient: jest.fn(), loadAccountsWithClient: jest.fn() }))
jest.mock('@/app/accounting/paging', () => ({ readAllAccountingRows: jest.fn() }))
const siteId = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const version = '2026-09-29T12:00:00Z'
const draft = { entry: { siteId, entryDate: '2026-09-29', memo: 'Invoice', currency: 'USD', sourceType: 'sale' as const,
  sourceId, idempotencyKey: `sale:${sourceId}` },
  lines: [{ accountCode: '1100', debit: 100, credit: 0 }, { accountCode: '4000', debit: 0, credit: 100 }] }

describe('source journals use one atomic operation', () => {
  let client: any, chain: any, source: any
  beforeEach(() => {
    jest.clearAllMocks()
    source = { id: sourceId, site_id: siteId, updated_at: version, accounting_state: 'pending' }
    chain = { select: jest.fn(() => chain), eq: jest.fn(() => chain), order: jest.fn(() => chain),
      single: jest.fn(async () => ({ data: source, error: null })) }
    client = { from: jest.fn(() => chain), rpc: jest.fn(async () => ({ data: null, error: null })) }
    jest.mocked(loadAccountsWithClient).mockResolvedValue([{ code: '4000', key: 'revenue' } as any])
    jest.mocked(readAllAccountingRows).mockResolvedValue([])
    jest.mocked(buildSaleJournalDrafts).mockReturnValue([draft])
    jest.mocked(buildPurchaseJournalDrafts).mockReturnValue([])
    jest.mocked(buildFromExpense).mockReturnValue(null)
  })
  it('fetches the source within the site and replaces all related journals in one RPC', async () => {
    await postSourceJournalWithClient(client, 'sale', sourceId, siteId)
    expect(chain.eq).toHaveBeenCalledWith('site_id', siteId)
    expect(ensureChartWithClient).toHaveBeenCalledWith(client, siteId)
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith('accounting_replace_source_journals', expect.objectContaining({
      p_site_id: siteId, p_source_id: sourceId, p_source_type: 'sale', p_source_updated_at: version,
      p_entries: [expect.objectContaining({ entry: expect.objectContaining({ idempotency_key: `sale:${sourceId}` }) })], p_state: 'posted',
    }))
    expect(client.from).not.toHaveBeenCalledWith('journal_entries')
    expect(client.from).not.toHaveBeenCalledWith('journal_lines')
  })
  it('keeps intentionally unpublished sources unpublished during automatic sync', async () => {
    source.accounting_state = 'unpublished'
    await postSourceJournalWithClient(client, 'sale', sourceId, siteId, { skipUnpublished: true })
    expect(client.rpc).not.toHaveBeenCalled()
    expect(ensureChartWithClient).not.toHaveBeenCalled()
  })
  it('never replaces a legacy draft purchase with an empty set when journal history exists', async () => {
    source.status = 'draft'
    chain.limit = jest.fn(async () => ({ data: [{ id: 'old-journal' }], error: null }))
    await expect(postSourceJournalWithClient(client,'purchase',sourceId,siteId)).rejects.toThrow('cannot remove')
    expect(client.rpc).not.toHaveBeenCalled()
    expect(buildPurchaseJournalDrafts).not.toHaveBeenCalled()
  })
  it('removes legacy analytics-only discount postings atomically', async () => {
    await postSourceJournalWithClient(client, 'expense', sourceId, siteId)
    expect(client.rpc).toHaveBeenCalledWith('accounting_replace_source_journals', expect.objectContaining({ p_entries: [], p_state: 'posted' }))
  })
  it('never writes when refund loading or source validation fails', async () => {
    jest.mocked(readAllAccountingRows).mockRejectedValueOnce(new Error('refund unavailable'))
    await expect(postSourceJournalWithClient(client, 'sale', sourceId, siteId)).rejects.toThrow('refund unavailable')
    jest.mocked(buildSaleJournalDrafts).mockImplementationOnce(() => { throw new Error('payment date missing') })
    await expect(postSourceJournalWithClient(client, 'sale', sourceId, siteId)).rejects.toThrow('payment date missing')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('rejects invalid drafts before changing the existing journal', async () => {
    await expect(replaceSourceJournals(client, siteId, 'sale', sourceId, version, [{ ...draft, lines: [draft.lines[0]] }], 'posted')).rejects.toThrow()
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('passes dated refunds from storage to the builder even for a cancelled source', async () => {
    source.status = 'cancelled'
    const refund = { id: 're_cancelled', amount: 100, currency: 'USD', refunded_at: '2026-09-29' }
    jest.mocked(readAllAccountingRows).mockResolvedValueOnce([refund])
    await postSourceJournalWithClient(client, 'sale', sourceId, siteId)
    expect(buildSaleJournalDrafts).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', refunds: [refund] }), null, expect.any(Map))
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })
  it('propagates version conflicts with no fallback deletes/inserts', async () => {
    client.rpc.mockResolvedValue({ error: { code: '40001' } })
    await expect(postSourceJournalWithClient(client, 'sale', sourceId, siteId)).rejects.toThrow('changed')
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })
})