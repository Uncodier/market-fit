/** @jest-environment node */
import { getDeviceOrderSnapshots } from '@/app/commerce/device-order-snapshots'
import { createServiceClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }))

it('keeps bearer order snapshots available independently and filters revoked/expired tokens', async () => {
  const token = 'a'.repeat(64)
  const query = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [
      { id: 'active', public_access_token: token, public_access_token_expires_at: null, public_access_token_revoked_at: null },
      { id: 'revoked', public_access_token: token, public_access_token_revoked_at: '2026-01-01T00:00:00Z' },
      { id: 'expired', public_access_token: token, public_access_token_expires_at: '2020-01-01T00:00:00Z' },
    ], error: null }).then(resolve) }
  const entitlements = { ...query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) }
  jest.mocked(createServiceClient).mockResolvedValue({ from: (table: string) => table === 'sale_orders' ? query : entitlements } as never)
  const result = await getDeviceOrderSnapshots([token])
  expect(result.data?.map(order => order.orderId)).toEqual(['active'])
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: 'public' })
})