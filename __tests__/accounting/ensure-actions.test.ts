import { upsertPolizaForSale, removePolizaForSource, ensurePolizasForPeriod } from '@/app/accounting/ensure'
import { requireAccountingAccess } from '@/app/accounting/access'
import { createServiceClient } from '@/lib/supabase/server'
import { postSourceJournalWithClient, replaceSourceJournals } from '@/app/accounting/source-posting'
import { readAllAccountingRows } from '@/app/accounting/paging'

jest.mock('server-only', () => ({}))
jest.mock('@/app/accounting/access', () => ({ requireAccountingAccess: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/app/accounting/paging', () => ({ readAllAccountingRows: jest.fn() }))
jest.mock('@/app/accounting/source-posting', () => ({ postSourceJournalWithClient: jest.fn(), replaceSourceJournals: jest.fn(),
  sourceTables: { sale: 'sales', expense: 'transactions', purchase: 'purchases' } }))
const siteId = '11111111-1111-4111-8111-111111111111'
const saleId = '22222222-2222-4222-8222-222222222222'

describe('source action authorization and period reconciliation', () => {
  let userClient: any, chain: any
  const service = { trusted: true }
  beforeEach(() => {
    jest.clearAllMocks()
    chain = { select: jest.fn(() => chain), eq: jest.fn(() => chain),
      single: jest.fn(async () => ({ data: { id: saleId, site_id: siteId, updated_at: '2026-09-29' } })) }
    userClient = { from: jest.fn(() => chain) }
    jest.mocked(requireAccountingAccess).mockResolvedValue(userClient)
    jest.mocked(createServiceClient).mockResolvedValue(service as any)
    jest.mocked(postSourceJournalWithClient).mockResolvedValue(undefined)
    jest.mocked(replaceSourceJournals).mockResolvedValue(undefined)
    jest.mocked(readAllAccountingRows).mockResolvedValue([])
  })
  it('checks user role and exact source site before creating any privileged client', async () => {
    await upsertPolizaForSale(saleId, siteId)
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, 'update')
    expect(chain.eq).toHaveBeenCalledWith('site_id', siteId)
    expect(chain.eq).toHaveBeenCalledWith('id', saleId)
    expect(createServiceClient).toHaveBeenCalledWith(true)
    expect(postSourceJournalWithClient).toHaveBeenCalledWith(service, 'sale', saleId, siteId)
  })
  it('denies before elevation when either role or source access is denied', async () => {
    jest.mocked(requireAccountingAccess).mockRejectedValueOnce(new Error('Forbidden'))
    await expect(upsertPolizaForSale(saleId, siteId)).rejects.toThrow('Forbidden')
    chain.single.mockResolvedValueOnce({ data: null })
    await expect(upsertPolizaForSale(saleId, siteId)).rejects.toThrow('not found')
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it('requires delete rights to unpublish and uses one atomic source reconciliation', async () => {
    await removePolizaForSource('sale', saleId, siteId)
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, 'delete')
    expect(replaceSourceJournals).toHaveBeenCalledWith(service, siteId, 'sale', saleId, '2026-09-29', [], 'unpublished')
  })
  it('finds a prior-period sale by its new receipt or refund date', async () => {
    jest.mocked(readAllAccountingRows).mockResolvedValueOnce([{ id: saleId, sale_date: '2026-08-01',
      updated_at: '2026-08-01', payments: [{ amount: 100, date: '2026-09-15' }] }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ sale_id: saleId }])
    await ensurePolizasForPeriod(siteId, '2026-09-01', '2026-09-30')
    expect(postSourceJournalWithClient).toHaveBeenCalledTimes(1)
    expect(postSourceJournalWithClient).toHaveBeenCalledWith(service, 'sale', saleId, siteId, { skipUnpublished: true })
  })
  it('reports partial synchronization failures instead of a false success', async () => {
    jest.mocked(readAllAccountingRows).mockResolvedValueOnce([{ id: saleId, sale_date: '2026-09-01' }])
    jest.mocked(postSourceJournalWithClient).mockRejectedValueOnce(new Error('invalid'))
    await expect(ensurePolizasForPeriod(siteId, '2026-09-01', '2026-09-30')).rejects.toThrow('1 of 1 sources')
  })
})