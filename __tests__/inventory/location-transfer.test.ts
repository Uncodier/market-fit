/** @jest-environment node */
import { transferInventory } from '@/app/inventory/actions'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

describe('atomic location transfers', () => {
  const rpc = jest.fn()
  const from = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(createClient).mockResolvedValue({ rpc, from } as never)
  })
  it('delegates both endpoints and quantity to the authenticated atomic writer', async () => {
    rpc.mockResolvedValue({ data: { from_quantity: 5, to_quantity: 3 }, error: null })
    expect(await transferInventory('site', 'item', 'from', 'to', 3)).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith('transfer_location_inventory', {
      p_site_id: 'site', p_catalog_item_id: 'item', p_from_location_id: 'from', p_to_location_id: 'to', p_quantity: 3,
    })
    expect(from).not.toHaveBeenCalled()
  })
  it.each(['42501', 'PGRST202', '23503'])('never decrements source separately when denied or unavailable (%s)', async code => {
    rpc.mockResolvedValue({ data: null, error: { code } })
    expect(await transferInventory('site', 'item', 'from', 'to', 3)).toHaveProperty('error')
    expect(from).not.toHaveBeenCalled()
  })
})