import { updateShipmentStatus } from '@/app/shipments/actions'
import { createClient } from '@/lib/supabase/server'
import { userCanOnSite } from '@/lib/permissions/site-access'

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/permissions/site-access', () => ({ userCanOnSite: jest.fn() }))

function fixture(options: { review?: boolean; failAt?: number; updateFailure?: boolean } = {}) {
  function chain(data: unknown) {
    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data }),
      maybeSingle: jest.fn().mockResolvedValue({ data }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data }).then(resolve) }
  }
  const shipments = chain({ status: 'preparing', stock_decremented: true,
    sale_order_id: 'order', origin_location_id: 'origin' })
  if (options.updateFailure) shipments.update.mockImplementation(() => {
    throw new Error('status write failed')
  })
  const lines = chain([{ id: 'first', catalog_item_id: 'sku', quantity: 5, status: 'completed' },
    { id: 'second', catalog_item_id: 'sku', quantity: 2 }])
  const totals = new Map<string, number>()
  let calls = 0
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'actor' } } }) },
    from: jest.fn((table: string) => {
      if (table === 'shipments') return shipments
      if (table === 'sale_order_items') return lines
      if (table === 'sale_orders') return chain({ sale: { source: 'pos' } })
      if (table === 'settings') return chain({ commerce: { decrement_stock_on: 'ship' } })
      throw new Error(`Unexpected legacy access ${table}`)
    }),
    rpc: jest.fn(async (_name: string, args: { p_site_id: string; p_line_id?: string; p_target_quantity?: number }) => {
      if (!args.p_line_id || args.p_target_quantity === undefined) throw new Error('Unexpected legacy RPC')
      calls++
      if (calls === options.failAt) return { data: null, error: { message: 'failed' } }
      const prior = totals.get(args.p_line_id) || 0
      const target = options.review ? prior : args.p_target_quantity
      totals.set(args.p_line_id, target)
      return { data: { review_required: !!options.review, debited_quantity: target,
        restocked_quantity: 0, applied_quantity: target - prior, skipped: false }, error: null }
    }),
  }
  jest.mocked(createClient).mockResolvedValue(client as never)
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  return { client, shipments, lines, totals }
}

beforeEach(() => jest.clearAllMocks())

test('full assigned quantities reconcile irrespective of fulfilled status and stale aggregate stock flag', async () => {
  const { client, lines, shipments, totals } = fixture()
  await expect(updateShipmentStatus('site', 'shipment', 'shipped')).resolves.toHaveProperty('data')
  await updateShipmentStatus('site', 'shipment', 'shipped')
  expect([...totals.values()]).toEqual([5, 2])
  expect(client.rpc).toHaveBeenCalledWith('reconcile_order_line_inventory', {
    p_site_id: 'site', p_order_id: 'order', p_line_id: 'first', p_location_id: 'origin',
    p_target_quantity: 5, p_mode: 'debit',
  })
  expect(lines.eq).toHaveBeenCalledWith('shipment_id', 'shipment')
  expect(lines.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(shipments.eq).toHaveBeenCalledWith('site_id', 'site')
})

test('second-line failure can retry without debiting successful first line twice', async () => {
  const { shipments, totals } = fixture({ failAt: 2 })
  expect(await updateShipmentStatus('site', 'shipment', 'shipped')).toHaveProperty('error')
  expect(shipments.update).not.toHaveBeenCalled()
  await updateShipmentStatus('site', 'shipment', 'shipped')
  expect([...totals.values()]).toEqual([5, 2])
})

test('status write failure after debit can retry without duplicate inventory movement', async () => {
  const { shipments, totals } = fixture({ updateFailure: true })
  expect(await updateShipmentStatus('site', 'shipment', 'shipped')).toHaveProperty('error')
  shipments.update.mockReturnThis()
  await updateShipmentStatus('site', 'shipment', 'shipped')
  expect([...totals.values()]).toEqual([5, 2])
})

test('legacy receipt review prevents shipment success and stock flags', async () => {
  const { shipments, totals } = fixture({ review: true })
  expect(await updateShipmentStatus('site', 'shipment', 'shipped')).toEqual({
    error: 'Inventory review required before shipping this order',
  })
  expect(shipments.update).not.toHaveBeenCalled()
  expect([...totals.values()]).toEqual([0])
})

test.each(['anonymous', 'forbidden'])('denies %s callers before inventory reads and RPC', async kind => {
  const { client } = fixture()
  if (kind === 'anonymous') client.auth.getUser.mockResolvedValue({ data: { user: null as never } })
  else jest.mocked(userCanOnSite).mockResolvedValue(false)
  expect(await updateShipmentStatus('site', 'shipment', 'shipped')).toHaveProperty('error')
  expect(client.from).not.toHaveBeenCalled()
  expect(client.rpc).not.toHaveBeenCalled()
})