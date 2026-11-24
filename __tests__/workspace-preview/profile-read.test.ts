import { readVisibleProfile, readVisibleProfiles } from '@/app/services/read-visible-profile'

it('reads the visible profile with this caller and never sends a profile ID to Auth or caches another session’s name', async () => {
  const maybeSingle = jest.fn().mockResolvedValueOnce({ data: { id: 'same', name: 'Visible', avatar_url: 'url' }, error: null })
    .mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle }
  const client = { from: jest.fn(() => query), auth: { getUser: jest.fn() } }
  await expect(readVisibleProfile(client, 'same')).resolves.toEqual({ name: 'Visible', avatar_url: 'url' })
  for (let i = 0; i < 2; i++) await expect(readVisibleProfile(client, 'same')).resolves.toEqual({ name: 'Team Member (same...)', avatar_url: null })
  expect(query.select).toHaveBeenCalledWith('id, name, avatar_url'); expect(client.auth.getUser).not.toHaveBeenCalled()
})

it('groups repeated assignee IDs into bounded RLS reads and does not return omitted or unrelated profiles', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => `a-${i}`)
  const query = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), retry: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockResolvedValueOnce({ data: [{ id: ids[0], name: 'Visible' }, { id: 'outside', name: 'Other' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null }) }
  const db = { from: jest.fn(() => query) }
  const data = await readVisibleProfiles(db, [...ids, ids[0]], new AbortController().signal)
  expect(db.from).toHaveBeenCalledTimes(2); expect(query.in).toHaveBeenNthCalledWith(1, 'id', ids.slice(0, 50))
  expect(Object.keys(data)).toEqual([ids[0]])
  const stopped = new AbortController(); stopped.abort()
  await expect(readVisibleProfiles(db, ids, stopped.signal)).rejects.toThrow('cancelled'); expect(db.from).toHaveBeenCalledTimes(2)
})