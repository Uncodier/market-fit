import { listBuyerQuotes } from '@/app/buyer/actions'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

test('rejects site scope instead of returning the personal buyer list', async () => {
  expect(await listBuyerQuotes({ scope: 'site' })).toEqual({
    error: 'Use site-scoped procurement quotations for workspace purchases',
  })
  expect(createClient).not.toHaveBeenCalled()
})

test('preserves authenticated personal quotations across suppliers', async () => {
  const rows = [{ id: 'quote-a', site_id: 'supplier-a' }, { id: 'quote-b', site_id: 'supplier-b' }]
  const query = {
    select: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(), range: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: rows, count: 2, error: null }),
  }
  jest.mocked(createClient).mockResolvedValue({
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'buyer' } } } }) },
    from: jest.fn(() => query),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  expect(await listBuyerQuotes({})).toEqual({ data: rows, count: 2 })
  expect(query.eq).toHaveBeenCalledWith('buyer_user_id', 'buyer')
})