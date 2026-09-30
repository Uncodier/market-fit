/** @jest-environment node */
import { getBalanceSheetReport, getPnLReport } from '@/app/finance/reports'
import { requireAccountingAccess } from '@/app/accounting/access'
import { createDemoMockClient } from '@/lib/demo-data/mock-client'
import { UNKNOWN_CURRENCY_MESSAGE, INVALID_JOURNAL_MESSAGE } from '@/app/finance/report-errors'

jest.mock('@/app/accounting/access', () => ({ requireAccountingAccess: jest.fn() }))
const site = '00000000-0000-4000-8000-000000000001'
let client: any
beforeEach(() => {
  jest.resetAllMocks()
  const query: any = { select: jest.fn(() => query), eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: { currency: 'USD' } })) }
  client = { from: jest.fn(() => query), rpc: jest.fn(async () => ({ data: { '4000': { debit: 0, credit: 12510 } } })) }
  jest.mocked(requireAccountingAccess).mockResolvedValue(client)
})

describe('consistent report RPC boundary', () => {
  it('fetches complete aggregates with a single snapshot request, not offset pages', async () => {
    expect(await getPnLReport(site, '2026-02-01', '2026-02-28', ' usd ')).toEqual({ '4000': { debit: 0, credit: 12510 } })
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).toHaveBeenCalledWith('accounting_report_snapshot', {
      p_site_id: site, p_from: '2026-02-01T00:00:00.000Z', p_to_exclusive: '2026-03-01T00:00:00.000Z',
      p_currency: 'USD', p_include_opening: false,
    })
  })
  it('includes opening entries and all prior dates only in the selected currency', async () => {
    await getBalanceSheetReport(site, '2026-02-28', 'EUR')
    expect(client.rpc).toHaveBeenCalledWith('accounting_report_snapshot', {
      p_site_id: site, p_from: null, p_to_exclusive: '2026-03-01T00:00:00.000Z', p_currency: 'EUR', p_include_opening: true,
    })
  })
  it('derives an omitted currency only from authorized site settings', async () => {
    await getBalanceSheetReport(site, '2026-02-28')
    expect(client.from).toHaveBeenCalledWith('settings')
    expect(client.rpc.mock.calls[0][1].p_currency).toBe('USD')
  })
  it.each(['', 'ZZZ', 'US', 'USD,EUR'])('rejects invalid explicit currency %s', async currency => {
    await expect(getPnLReport(site, '2026-02-01', '2026-02-28', currency)).rejects.toThrow('currency')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it.each([['2026-02-30','2026-03-01'],['invalid','2026-03-01'],['2026-03-01','2026-02-01']])('rejects invalid period %s %s', async (from,to) => {
    await expect(getPnLReport(site, from, to, 'USD')).rejects.toThrow()
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it.each([['ACCOUNTING_UNKNOWN_CURRENCY',UNKNOWN_CURRENCY_MESSAGE],['ACCOUNTING_INVALID_JOURNAL',INVALID_JOURNAL_MESSAGE]])('requires reconciliation for %s', async (message, expected) => {
    client.rpc.mockResolvedValue({ data: null, error: { message } })
    await expect(getBalanceSheetReport(site,'2026-09-29','USD')).rejects.toThrow(expected)
  })
  it('does not return zeros or use an unsafe paging fallback if the snapshot query fails', async () => {
    client.rpc.mockResolvedValue({ error: { message: 'database offline' } })
    await expect(getBalanceSheetReport(site,'2026-09-29','USD')).rejects.toThrow('consistent')
    expect(client.from).not.toHaveBeenCalled()
  })
  it('rejects malformed or unsafe aggregate amounts', async () => {
    client.rpc.mockResolvedValueOnce({ data: { '4000': { debit: 'bad', credit: 1 } } })
    await expect(getBalanceSheetReport(site,'2026-09-29','USD')).rejects.toThrow('invalid')
    client.rpc.mockResolvedValueOnce({ data: { '4000': { debit: 0, credit: 0.001 } } })
    await expect(getBalanceSheetReport(site,'2026-09-29','USD')).rejects.toThrow('fractional')
  })
  it('denies access before invoking any database operation', async () => {
    jest.mocked(requireAccountingAccess).mockRejectedValue(new Error('Forbidden'))
    await expect(getBalanceSheetReport(site,'2026-09-29','USD')).rejects.toThrow('Forbidden')
    expect(client.rpc).not.toHaveBeenCalled()
    expect(client.from).not.toHaveBeenCalled()
  })
  it('keeps read-only demo data working without replacing the production RPC', async () => {
    jest.mocked(requireAccountingAccess).mockResolvedValue(createDemoMockClient('demo-saas-en-123'))
    expect(Object.keys(await getPnLReport('demo-saas-en-123','2000-01-01','2100-01-01','USD')).length).toBeGreaterThan(0)
  })
})