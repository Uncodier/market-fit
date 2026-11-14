import { usesOrderLineInventoryReceipts } from '@/app/commerce/order-inventory-scope'

jest.mock('server-only', () => ({}))

test.each([
  [{ sale: { source: 'pos' } }, true],
  [{ sale: [{ source: 'pos' }] }, true],
  [{ sale: { source: 'shop' } }, false],
  [{ sale: { source: 'pos' }, items: [{ metadata: { self_service: true } }] }, false],
])('resolves persisted receipt ownership %#', async (order, expected) => {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: order }) }
  expect(await usesOrderLineInventoryReceipts({ from: () => query }, 'site', 'order')).toBe(expected)
  expect(query.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(query.eq).toHaveBeenCalledWith('id', 'order')
})

test.each([{ data: null }, { data: null, error: { message: 'denied' } }])(
  'inaccessible or cross-site order fails closed %#', async response => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(response) }
    await expect(usesOrderLineInventoryReceipts({ from: () => query }, 'site', 'foreign-order'))
      .rejects.toThrow('ownership could not be verified')
  },
)