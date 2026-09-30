/** @jest-environment node */
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createDemoMockClient } from '@/lib/demo-data/mock-client'
import { listPurchases } from '@/app/purchases/purchase-queries'
import { requirePurchaseAccess } from '@/app/purchases/purchase-access'
import { purchaseClient, siteId } from './security-fixtures'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))
const demoId = 'demo-saas-en-123'
const selectDemo = (id: string | undefined = demoId) => {
  jest.mocked(cookies).mockResolvedValue({ get: () => id ? { value: id } : undefined } as Awaited<ReturnType<typeof cookies>>)
}

describe('demo purchase list isolation', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    selectDemo()
  })
  afterEach(() => jest.restoreAllMocks())

  it('preserves the empty selected demo list using the existing demo implementation only', async () => {
    const demo = createDemoMockClient(demoId)
    const auth = jest.spyOn(demo.auth, 'getUser')
    jest.mocked(createClient).mockResolvedValue(demo)
    expect(await listPurchases({ siteId: demoId })).toEqual({ data: [], count: 0, error: null })
    expect(createClient).toHaveBeenCalledWith()
    expect(auth).not.toHaveBeenCalled()
  })

  it.each([undefined, 'demo-habituall', siteId])('rejects an unselected demo with cookie %s', async cookie => {
    jest.mocked(cookies).mockResolvedValue({ get: () => cookie ? { value: cookie } : undefined } as Awaited<ReturnType<typeof cookies>>)
    expect((await listPurchases({ siteId: demoId })).error).toContain('Select this demo')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('never queries a real client when a demo was requested', async () => {
    const state = purchaseClient()
    jest.mocked(createClient).mockResolvedValue(state.client)
    expect((await listPurchases({ siteId: demoId })).error).toBe('Demo purchase data is unavailable')
    expect(state.client.from).not.toHaveBeenCalled()
    expect(state.client.auth.getUser).not.toHaveBeenCalled()
  })

  it('rejects unknown demo IDs rather than silently falling back to real data', async () => {
    selectDemo('demo-missing')
    jest.mocked(createClient).mockResolvedValue(createDemoMockClient('demo-missing'))
    expect((await listPurchases({ siteId: 'demo-missing' })).error).toBe('Demo site not found')
  })

  it('still requires real authentication for a real site even with a demo cookie', async () => {
    const state = purchaseClient()
    state.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    jest.mocked(createClient).mockResolvedValue(state.client)
    expect((await listPurchases({ siteId })).error).toBe('Not authenticated')
    expect(createClient).toHaveBeenCalledWith(true)
    expect(state.client.from).not.toHaveBeenCalled()
  })

  it.each(['insert', 'update', 'delete'] as const)('does not enable demo %s access', async command => {
    const state = purchaseClient()
    jest.mocked(createClient).mockResolvedValue(state.client)
    await expect(requirePurchaseAccess(demoId, command)).rejects.toThrow('Demo purchases are read-only')
    expect(state.client.from).not.toHaveBeenCalled()
    expect(state.client.rpc).not.toHaveBeenCalled()
  })
})