import { restockOrderInventory } from '@/app/commerce/restock-order-inventory'

jest.mock('server-only', () => ({}))

function fixture(options: { review?: boolean; failAt?: number; missingLines?: boolean; reducedLine?: boolean } = {}) {
  function chain(data: unknown) {
    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data }).then(resolve) }
  }
  const order = chain({ sale: { source: 'pos' }, items: [] })
  const lines = chain(options.missingLines ? [] : [{ id: 'first', quantity: options.reducedLine ? 1 : 5 }, { id: 'second', quantity: 3 }])
  const shipments = chain([{ id: 'shipment', status: 'shipped' }])
  const refunds = new Map<string, number>()
  let calls = 0
  const client = {
    from: jest.fn((table: string) => {
      if (table === 'sale_orders') return order
      if (table === 'sale_order_items') return lines
      if (table === 'shipments') return shipments
      throw new Error(`Unexpected legacy access ${table}`)
    }),
    rpc: jest.fn(async (_name: string, args: { p_site_id: string; p_line_id?: string; p_target_quantity?: number }) => {
      if (!args.p_line_id || args.p_target_quantity === undefined) throw new Error('Unexpected legacy RPC')
      calls++
      if (calls === options.failAt) return { data: null, error: { message: 'connection lost' } }
      // Only the receipt determines the refund budget, not the current line quantity.
      const budget = options.reducedLine ? 5 : 2
      const prior = refunds.get(args.p_line_id) || 0
      const target = options.review ? 0 : Math.min(args.p_target_quantity, budget)
      refunds.set(args.p_line_id, target)
      return { data: { review_required: !!options.review, debited_quantity: budget,
        restocked_quantity: target, applied_quantity: target - prior, skipped: false }, error: null }
    }),
  }
  return { client, order, lines, shipments, refunds }
}

const order = { id: 'order', site_id: 'site', status: 'completed', origin_location_id: 'changed-origin' }

test('refund reconciles full line cumulative total against receipt origin and actual debit, even on cancelled replay', async () => {
  const { client, refunds, lines, shipments } = fixture()
  await restockOrderInventory(client, order)
  await restockOrderInventory(client, { ...order, status: 'cancelled' })
  expect([...refunds.values()]).toEqual([2, 2])
  expect(client.rpc).toHaveBeenNthCalledWith(1, 'reconcile_order_line_inventory', {
    p_site_id: 'site', p_order_id: 'order', p_line_id: 'first', p_location_id: null,
    p_target_quantity: 1_000_000_000, p_mode: 'restock',
  })
  for (const query of [lines, shipments]) expect(query.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(client.from).not.toHaveBeenCalledWith('settings')
  expect(client.from).not.toHaveBeenCalledWith('inventory_levels')
})

test('full cancellation refunds all five debited units after line quantity was reduced to one', async () => {
  const { client, refunds } = fixture({ reducedLine: true })
  await restockOrderInventory(client, order)
  await restockOrderInventory(client, { ...order, status: 'cancelled' })
  expect(refunds.get('first')).toBe(5)
  expect(client.rpc).toHaveBeenCalledWith('reconcile_order_line_inventory', expect.objectContaining({
    p_line_id: 'first', p_target_quantity: 1_000_000_000, p_mode: 'restock',
  }))
})

test('partial refund failure retains shipment flags and safely reconciles on retry', async () => {
  const { client, refunds, shipments } = fixture({ failAt: 2 })
  await expect(restockOrderInventory(client, order)).rejects.toThrow('Failed to reconcile')
  expect(shipments.update).not.toHaveBeenCalled()
  await restockOrderInventory(client, { ...order, status: 'cancelled' })
  expect([...refunds.values()]).toEqual([2, 2])
  expect(shipments.update).toHaveBeenCalledWith({ status: 'cancelled', stock_decremented: false })
})

test('legacy absent receipt requires review rather than trusting fulfilled quantity or shipment flags', async () => {
  const { client, shipments, refunds } = fixture({ review: true })
  await expect(restockOrderInventory(client, order)).rejects.toThrow('Inventory review required')
  expect(shipments.update).not.toHaveBeenCalled()
  expect([...refunds.values()]).toEqual([0])
})

test('serialized legacy quantities never substitute for missing persisted line identities', async () => {
  const { client } = fixture({ missingLines: true })
  await expect(restockOrderInventory(client, { ...order, items: [{ catalog_item_id: 'sku', quantity: 10 }] }))
    .rejects.toThrow('persisted order lines are missing')
  expect(client.rpc).not.toHaveBeenCalled()
})