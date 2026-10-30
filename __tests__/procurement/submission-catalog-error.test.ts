/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/procurement/commerce/submissions/route'
import { procurementMessage } from '@/app/purchases/procurement/i18n/messages'
import { commerceResult } from '@/app/api/procurement/commerce/http'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const rpc = jest.fn()
const diagnostic = 'A catalog item linked to this tender is unavailable or uses a different currency. Ask the buyer to correct the linked item. Your quotation was not submitted.'
function request() {
  return new Request(`http://localhost/api/procurement/commerce/submissions?site_id=${id}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ supplier_id: id, tender_id: id, publication_id: id, reference: 'Offer',
      idempotency_key: id, lines: [{ requirement_id: id, unit_net_minor: 1000 }], evidence: [] }),
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc } as never)
})
test('known catalog mapping rejection explains the buyer action without leaking SQL', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Active same-currency catalog mapping required', details: 'PRIVATE' } })
  const response = await POST(request())
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ error: diagnostic })
  expect(procurementMessage(diagnostic, 'es')).toContain('Tu cotización no fue enviada')
})
test('unknown database errors remain private', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'PRIVATE' } })
  const response = await POST(request())
  expect(response.status).toBe(422)
  expect(await response.text()).not.toContain('PRIVATE')
})
test('unauthenticated callers cannot inspect tender validation', async () => {
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) }, rpc } as never)
  expect((await POST(request())).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})

test('order validation exposes only the safe unresolved-tax diagnostic', async () => {
  const message = 'Quotation catalog mapping and taxes must be resolved before ordering'
  const response = commerceResult(null, { code: '22023', message })
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ error: message })
})