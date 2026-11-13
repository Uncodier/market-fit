/** @jest-environment node */
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createDemoMockClient } from '@/lib/demo-data/mock-client'
import { getPurchaseById, listPurchases } from '@/app/purchases/purchase-queries'
import { requirePurchaseAccess } from '@/app/purchases/purchase-access'
import { purchaseClient, siteId } from './security-fixtures'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

const demoId = 'demo-ecom-es-456'
const billId = `demo-payable-${demoId}-1`
function selectDemo(id: string | undefined) {
  jest.mocked(cookies).mockResolvedValue({ get: () => id ? { value: id } : undefined } as Awaited<ReturnType<typeof cookies>>)
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  selectDemo(demoId)
})
afterEach(() => jest.restoreAllMocks())

it('opens every bill linked from the selected demo list without real authentication', async () => {
  const demo = createDemoMockClient(demoId)
  const auth = jest.spyOn(demo.auth, 'getUser')
  jest.mocked(createClient).mockResolvedValue(demo)
  const list = await listPurchases({ siteId: demoId })
  expect(list.error).toBeNull()
  expect(list.data?.length).toBeGreaterThan(0)
  for (const bill of list.data || []) {
    const detail = await getPurchaseById(demoId, bill.id)
    expect(detail.error).toBeNull()
    expect(detail.purchase).toMatchObject({ id: bill.id, siteId: demoId, title: bill.title, amount: bill.amount })
    expect(detail.purchase?.vendorName).toBe(bill.vendorName)
  }
  expect(auth).not.toHaveBeenCalled()
  expect(createClient).toHaveBeenCalledWith()
  expect((await getPurchaseById(demoId, billId)).purchase?.vendorName).toBeTruthy()
})

it.each([undefined, 'demo-habituall', siteId])('rejects an unselected demo with cookie %s', async cookie => {
  selectDemo(cookie)
  expect((await getPurchaseById(demoId, billId)).error).toContain('Select this demo')
  expect(createClient).not.toHaveBeenCalled()
})

it('never queries real data when the demo client is unavailable', async () => {
  const state = purchaseClient()
  jest.mocked(createClient).mockResolvedValue(state.client)
  expect((await getPurchaseById(demoId, billId)).error).toBe('Demo purchase data is unavailable')
  expect(state.client.from).not.toHaveBeenCalled()
  expect(state.client.auth.getUser).not.toHaveBeenCalled()
})

it.each(['demo-payable-demo-habituall-1', 'missing', siteId])('does not return a foreign or missing bill %s', async id => {
  jest.mocked(createClient).mockResolvedValue(createDemoMockClient(demoId))
  const result = await getPurchaseById(demoId, id)
  expect(result.purchase).toBeNull()
  expect(result.error).toBeTruthy()
})

it('rejects demo purchase IDs on a real site before creating a client', async () => {
  expect(await getPurchaseById(siteId, billId)).toEqual({ purchase: null, error: 'Invalid purchase ID' })
  expect(createClient).not.toHaveBeenCalled()
})

it.each(['insert', 'update', 'delete'] as const)('keeps demo bills read-only for %s', async command => {
  await expect(requirePurchaseAccess(demoId, command, billId)).rejects.toThrow()
  expect(createClient).not.toHaveBeenCalled()
})