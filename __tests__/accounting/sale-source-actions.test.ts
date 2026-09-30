import { updateSale, deleteSale } from '@/app/sales/actions'
import { requireAccountingAccess } from '@/app/accounting/access'
import { tryUpsertPolizaForSale, removePolizaForSource } from '@/app/accounting/ensure'
import { deleteAccountingSource } from '@/app/accounting/source-lifecycle'
jest.mock('@/app/accounting/source-lifecycle', () => ({ deleteAccountingSource: jest.fn() }))

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/app/accounting/access', () => ({ requireAccountingAccess: jest.fn() }))
jest.mock('@/app/accounting/ensure', () => ({ tryUpsertPolizaForSale: jest.fn(), removePolizaForSource: jest.fn() }))
jest.mock('@/app/commerce/order-fulfillment-sync', () => ({
  shouldFulfillPaidSale: jest.fn(() => false), shouldRevokeSale: jest.fn(() => false),
  fulfillLinkedOrderAfterPayment: jest.fn(), revokeOrderFulfillment: jest.fn(),
}))

describe('sale mutations maintain accounting state', () => {
  let client: any, chain: any, previous: any
  const sale = { id: 'sale', amount: 100, amount_due: 50, title: 'Invoice', productName: 'Service',
    status: 'pending', source: 'retail', payments: [{ id: 'p', date: '2026-09-29', amount: 50, method: 'cash' }] } as any
  beforeEach(() => {
    jest.clearAllMocks()
    previous = { status: 'pending', accounting_state: 'posted' }
    chain = { select: jest.fn(() => chain), eq: jest.fn(() => chain), update: jest.fn(() => chain),
      delete: jest.fn(() => chain), single: jest.fn(async () => ({ data: sale })),
      maybeSingle: jest.fn(async () => ({ data: previous })),
      then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) }
    client = { from: jest.fn(() => chain) }
    jest.mocked(requireAccountingAccess).mockResolvedValue(client)
    jest.mocked(tryUpsertPolizaForSale).mockResolvedValue(undefined)
    jest.mocked(removePolizaForSource).mockResolvedValue(undefined)
  })
  it('marks source pending and advances version before rebuilding its dated journal', async () => {
    await expect(updateSale('site', sale)).resolves.toEqual({ sale })
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ accounting_state: 'pending', updated_at: expect.any(String) }))
    expect(tryUpsertPolizaForSale).toHaveBeenCalledWith('sale', 'site')
    expect(requireAccountingAccess).toHaveBeenCalledWith('site', 'update')
  })
  it('preserves deliberate unpublished state', async () => {
    previous.accounting_state = 'unpublished'
    await updateSale('site', sale)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ accounting_state: 'unpublished' }))
  })
  it('cannot remove a source when journal cleanup fails', async () => {
    jest.mocked(deleteAccountingSource).mockRejectedValue(new Error('conflict'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(deleteSale('site', 'sale')).resolves.toMatchObject({ error: expect.any(String) })
    expect(chain.delete).not.toHaveBeenCalled()
    expect(deleteAccountingSource).toHaveBeenCalledWith('site', 'sale', 'sale')
    expect(removePolizaForSource).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})