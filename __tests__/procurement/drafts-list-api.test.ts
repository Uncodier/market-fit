/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { GET } from '@/app/api/procurement/credentials/drafts/list/route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const create = jest.mocked(createClient)
const url = 'http://localhost/api/procurement/credentials/drafts/list'
let rpc: jest.Mock
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: [], error: null })
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) }, rpc } as never)
})
test('authenticates independently, denies demo mode, and keeps errors private', async () => {
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  const response = await GET(new Request(url))
  expect(response.status).toBe(401)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect((await GET(new Request(url, { headers: { cookie: 'market_fit_demo_site_id=demo' } }))).status).toBe(403)
  expect(rpc).not.toHaveBeenCalled()
})
test.each(['owner_id=foreign', 'site_id=foreign', 'publication_id=foreign', 'limit=10', 'version=1&version=1'])(
  'accepts no client authority or query parameters: %s', async query => {
    expect((await GET(new Request(`${url}?${query}`))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
test('uses only the authenticated list RPC and returns nullable enrichment and eligibility', async () => {
  const row = { publication_id: 'publication', publication_version: 1, applicant_key: 'personal',
    updated_at: '2026-10-30T00:00:00Z', draft_revision: 2, reference: 'Quote', attempted: false,
    opportunity: null, can_resume: false }
  rpc.mockResolvedValue({ data: [row], error: null })
  const response = await GET(new Request(url))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ drafts: [row] })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(create).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith('procurement_submission_drafts_list')
})
test.each([['42501', 403], ['XX000', 503]])('sanitizes database errors %s', async (code, status) => {
  rpc.mockResolvedValue({ error: { code, message: 'secret internal SQL' } })
  const response = await GET(new Request(url))
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain('secret')
})
test('failed session lookup never reaches the database', async () => {
  create.mockRejectedValue(new Error('secret configuration'))
  expect((await GET(new Request(url))).status).toBe(503)
  expect(rpc).not.toHaveBeenCalled()
})