import { createAuthorizedShipment } from '@/app/shipments/create-shipment'
import { isUnassignedShipmentLine } from '@/app/shipments/shipment-line-selection'

jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

test('whole-line assignment includes completed/partially fulfilled units but excludes explicit skip and assigned lines', async () => {
  const candidates = [
    { id: 'partial', quantity: 5, status: 'in_progress', completed_quantity: 2 },
    { id: 'completed', quantity: 2, status: 'completed' },
    { id: 'skip', metadata: { completed_without_stock: true } },
    { id: 'assigned', shipment_id: 'existing' },
  ]
  expect(candidates.filter(isUnassignedShipmentLine).map(line => line.id)).toEqual(['partial', 'completed'])
  const lines = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: lines.update.mock.calls.length ? [{ id: 'partial' }, { id: 'completed' }] : candidates,
    }).then(resolve),
  }
  const shipment = { insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'new' } }) }
  const client = { from: jest.fn((table: string) => table === 'shipments' ? shipment : lines) }
  expect(await createAuthorizedShipment(client as never, {
    siteId: 'site', saleOrderId: 'order', originLocationId: 'origin', userId: 'actor',
    itemIds: candidates.map(line => line.id),
  })).toHaveProperty('data')
  expect(lines.in).toHaveBeenLastCalledWith('id', ['partial', 'completed'])
  expect(lines.is).toHaveBeenCalledWith('shipment_id', null)
  expect(lines.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(lines.eq).toHaveBeenCalledWith('sale_order_id', 'order')
})

test('concurrent assignment is not overwritten or reported as a successful shipment', async () => {
  const lines = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: lines.update.mock.calls.length ? [] : [{ id: 'line' }],
    }).then(resolve),
  }
  const shipment = { insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'new' } }) }
  const client = { from: jest.fn((table: string) => table === 'shipments' ? shipment : lines) }
  expect(await createAuthorizedShipment(client as never, {
    siteId: 'site', saleOrderId: 'order', originLocationId: 'origin', userId: 'actor', itemIds: ['line'],
  })).toEqual({ error: 'Shipment was created but line assignment could not be confirmed' })
  expect(lines.is).toHaveBeenCalledWith('shipment_id', null)
})