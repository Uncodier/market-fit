import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { moveRecordToTrash, moveCategoryToTrash, restoreRecord, restoreRecordCategory, getRecordTrash } from '@/app/records/trash-actions'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const mutations = [
  [moveRecordToTrash, 'trash_record', 'p_record_id'],
  [moveCategoryToTrash, 'trash_record_category', 'p_category_id'],
  [restoreRecord, 'restore_record', 'p_record_id'],
  [restoreRecordCategory, 'restore_record_category', 'p_category_id'],
] as const
let rpc: jest.Mock
let from: jest.Mock
let getUser: jest.Mock
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: [], error: null })
  from = jest.fn()
  getUser = jest.fn().mockResolvedValue({ data: { user: { id } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from } as never)
})
it.each(mutations)('uses authenticated RPC %s, never physical deletion', async (action, name, key) => {
  expect(await action(id)).toEqual({ success: true })
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith(name, { [key]: id })
  expect(from).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith('/records')
})
it.each(mutations)('denies anonymous and malformed mutation %s', async action => {
  expect(await action('invalid')).toHaveProperty('error')
  expect(createClient).not.toHaveBeenCalled()
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await action(id)).toEqual({ error: 'Not authenticated' })
  expect(rpc).not.toHaveBeenCalled()
})
it('returns manager authorization denial without bypassing the database', async () => {
  rpc.mockResolvedValue({ error: { message: 'Records trash access denied' } })
  expect(await moveCategoryToTrash(id)).toEqual({ error: expect.stringContaining('authorized workspace manager') })
  expect(from).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
})
it('lists Trash through the manager-scoped RPC and fails closed', async () => {
  expect(await getRecordTrash(id)).toEqual({ items: [], error: null })
  expect(rpc).toHaveBeenCalledWith('list_record_trash', { p_site_id: id })
  rpc.mockResolvedValue({ error: { message: 'denied' } })
  expect(await getRecordTrash(id)).toMatchObject({ items: null, error: expect.any(String) })
  rpc.mockClear()
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await getRecordTrash(id)).toMatchObject({ items: null, error: expect.any(String) })
  expect(rpc).not.toHaveBeenCalled()
})