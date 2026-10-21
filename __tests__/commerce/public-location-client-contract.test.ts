/** @jest-environment node */
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSaleByPublicToken } from '@/app/sales/send-actions'
import { getOrderByPublicToken } from '@/app/orders/send-actions'
import { getAvailableSlotsForItem, getBookedSeats } from '@/app/reservations/availability'
import { createShipment } from '@/app/shipments/actions'
import { createAuthorizedShipment } from '@/app/shipments/create-shipment'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

const token = 'a'.repeat(32)
const chain = (data: unknown, error: unknown = null) => {
  const result = { data, error }
  return { select: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(), gt: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(),
    single: jest.fn(async () => result), maybeSingle: jest.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) }
}
beforeEach(() => jest.clearAllMocks())

it.each([getSaleByPublicToken, getOrderByPublicToken])('public token reads never require a workspace session', async read => {
  const row = chain(null)
  jest.mocked(createServiceClient).mockImplementation(async (_skipDemo, options) => {
    if (options?.access !== 'public') throw new Error('Workspace access is not available to anonymous buyers')
    return { from: () => row } as never
  })
  await read(token)
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: 'public' })
  expect(row.eq).toHaveBeenCalledWith('public_access_token', token)
})

it('public availability retains independent aggregate access and fails closed on capacity lookup errors', async () => {
  const item = chain({ id: 'item', redeem_assignment_mode: 'round_robin' })
  const schedules = chain([])
  jest.mocked(createServiceClient).mockResolvedValue({ from: (table: string) => table === 'catalog_items' ? item : schedules } as never)
  expect(await getAvailableSlotsForItem('item', '2026-10-21', '2026-10-22')).toEqual([])
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: 'public' })
  const unavailable = chain(null, { message: 'permission denied' })
  await expect(getBookedSeats(['item'], new Date(), new Date(), { from: () => unavailable })).rejects.toThrow('capacity could not be verified')
})

it('internal shipment follow-up uses its existing authorized client without reconstructing workspace access', async () => {
  const inserted = chain({ id: 'shipment' })
  const client = { from: jest.fn(() => inserted) }
  expect(await createAuthorizedShipment(client as never, {
    siteId: 'site', saleOrderId: 'order', originLocationId: 'origin', userId: 'server-actor',
  })).toMatchObject({ data: { id: 'shipment' } })
  expect(createClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('an exposed shipment action cannot select service-role authorization from request input', async () => {
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  const forged = { siteId: 'site', saleOrderId: 'order', originLocationId: 'origin', userId: 'forged', forceServiceRole: true }
  expect(await createShipment(forged)).toEqual({ error: 'Shipment creation is not authorized' })
  expect(createServiceClient).not.toHaveBeenCalled()
})