/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { loadPublicTenders } from '@/app/tenders/public-data'
import { listSearchReservations, listSearchTenders } from '@/app/home/search/actions'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/app/tenders/public-data', () => ({ loadPublicTenders: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

test('rejects malformed pagination before reading private data', async () => {
  for (const page of [0, -1, 1.5, 101, NaN]) expect(await listSearchReservations(page)).toEqual({ error: 'Invalid page' })
  expect(createClient).not.toHaveBeenCalled()
})

test('requires a verified user and never queries reservations for an anonymous caller', async () => {
  const from = jest.fn()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) }, from } as never)
  expect(await listSearchReservations(1)).toEqual({ error: 'Not authenticated' })
  expect(from).not.toHaveBeenCalled()
})

test('scopes every page by trusted buyer identity with a read-only user client', async () => {
  const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), range: jest.fn() }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query)
  query.range.mockResolvedValue({ data: [{ id: 'reservation' }], count: 101, error: null })
  const from = jest.fn(() => query)
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'trusted-account' } }, error: null }) }, from } as never)
  expect(await listSearchReservations(2)).toEqual({ data: [{ id: 'reservation' }], count: 101 })
  expect(from).toHaveBeenCalledWith('reservations')
  expect(query.eq).toHaveBeenCalledWith('buyer_user_id', 'trusted-account')
  expect(query.range).toHaveBeenCalledWith(100, 199)
  query.range.mockResolvedValue({ error: { message: 'Private database detail' } })
  expect(await listSearchReservations(1)).toEqual({ error: 'Unable to load reservations' })
})

test('validates public tender input and delegates to the established public visibility boundary', async () => {
  expect(await listSearchTenders('x'.repeat(201), 1)).toEqual({ error: 'Invalid search' })
  expect(await listSearchTenders('kit', 0)).toEqual({ error: 'Invalid search' })
  expect(loadPublicTenders).not.toHaveBeenCalled()
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [], error: null })
  expect(await listSearchTenders('kit', 2)).toEqual({ data: [] })
  expect(loadPublicTenders).toHaveBeenCalledWith(undefined, undefined, 1, 'kit')
})