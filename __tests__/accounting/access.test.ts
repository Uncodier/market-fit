/** @jest-environment node */
import { requireAccountingAccess } from '@/app/accounting/access'
import { createClient } from '@/lib/supabase/server'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const siteId = '11111111-1111-4111-8111-111111111111'

describe('accounting server authorization', () => {
  let client: any
  beforeEach(() => {
    jest.clearAllMocks()
    client = { auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'actor' } }, error: null })) },
      rpc: jest.fn(async () => ({ data: 'collaborator', error: null })) }
    jest.mocked(createClient).mockResolvedValue(client)
  })
  it('uses verified identity and site role, not the UI permission store', async () => {
    await expect(requireAccountingAccess(siteId, 'update')).resolves.toBe(client)
    expect(createClient).toHaveBeenCalledWith(true)
    expect(client.auth.getUser).toHaveBeenCalled()
    expect(client.rpc).toHaveBeenCalledWith('current_user_site_role', { p_site_id: siteId })
  })
  it('denies anonymous and foreign-site requests', async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(requireAccountingAccess(siteId)).rejects.toThrow('Authentication')
    expect(client.rpc).not.toHaveBeenCalled()
    client.rpc.mockResolvedValue({ data: null })
    await expect(requireAccountingAccess(siteId)).rejects.toThrow('Not authorized')
  })
  it('denies collaborator delete and marketing writes', async () => {
    await expect(requireAccountingAccess(siteId, 'delete')).rejects.toThrow('Not authorized')
    client.rpc.mockResolvedValue({ data: 'marketing' })
    await expect(requireAccountingAccess(siteId, 'insert')).rejects.toThrow('Not authorized')
    await expect(requireAccountingAccess(siteId, 'select')).resolves.toBe(client)
  })
  it('rejects malformed IDs before accessing any database', async () => {
    await expect(requireAccountingAccess('not-a-site')).rejects.toThrow()
    expect(createClient).not.toHaveBeenCalled()
  })
  it('never permits demo writes or real site reads through demo credentials', async () => {
    jest.mocked(createClient).mockResolvedValue({ _isDemo: true } as any)
    await expect(requireAccountingAccess('demo-test', 'update')).rejects.toThrow('read-only')
    await expect(requireAccountingAccess('demo-test', 'select')).resolves.toMatchObject({ _isDemo: true })
    jest.mocked(createClient).mockResolvedValue(client)
    await expect(requireAccountingAccess('demo-test')).rejects.toThrow('read-only')
  })
})