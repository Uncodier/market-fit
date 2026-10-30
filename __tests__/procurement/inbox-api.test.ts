/** @jest-environment node */
import { GET } from '@/app/api/procurement/approvals/inbox/route'
import { createClient } from '@/lib/supabase/server'
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const request = (query = '', cookie = 'session=x') => new Request(`https://example.test/api/procurement/approvals/inbox?site_id=${site}&${query}`, { headers: { cookie } })
describe('unified approvals inbox', () => {
  let from: jest.Mock
  let fail: boolean
  beforeEach(() => {
    jest.clearAllMocks(); fail = false
    from = jest.fn((table: string) => {
      const query: Record<string, jest.Mock> = {}
      for (const method of ['select', 'eq', 'in', 'order', 'range', 'limit']) query[method] = jest.fn(() => query)
      query.maybeSingle = jest.fn(async () => ({ data: { revision: 1 }, error: null }))
      query.then = jest.fn(resolve => Promise.resolve({ count: 1, error: fail ? { message: 'secret' } : null,
        data: table === 'procurement_requests' ? [{ id, title: 'Request', status: 'submitted', revision: 2, updated_at: '2026-10-28T10:00:00Z' }]
          : table === 'procurement_tenders' ? [{ id, version: 3 }]
          : [{ id, target_id: id, event: 'publication', status: 'pending', target_version: 3, policy_revision: 1, created_at: '2026-10-28T11:00:00Z' }],
      }).then(resolve))
      return query
    })
    jest.mocked(createClient).mockResolvedValue({ from, auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
      rpc: async (name: string) => ({ data: name === 'current_user_site_role' ? 'collaborator' : name === 'user_can', error: null }),
    } as never)
  })
  test('merges RLS-scoped sources into one chronological table and normalizes submitted', async () => {
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.count).toBe(2)
    expect(body.rows.map((row: { stage: string }) => row.stage)).toEqual(['publication', 'requisition'])
    expect(body.rows.every((row: { status: string }) => row.status === 'pending')).toBe(true)
    for (const result of from.mock.results) expect(result.value.eq).toHaveBeenCalledWith('site_id', site)
  })
  test('stage filters query only their source, before pagination', async () => {
    await GET(request('stage=award&status=approved&page=1'))
    expect(from).toHaveBeenCalledTimes(3)
    const query = from.mock.results[0].value
    expect(query.eq).toHaveBeenCalledWith('event', 'award')
    expect(query.eq).toHaveBeenCalledWith('status', 'approved')
    expect(query.range).toHaveBeenCalledWith(0, 99)
  })
  test.each(['stage=bad', 'status=won', 'page=101', 'stage=award&stage=order'])('rejects invalid filters %s', async query => {
    expect((await GET(request(query))).status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })
  test('fails closed without credentials and without partial results on query failure', async () => {
    expect((await GET(request('', ''))).status).toBe(401)
    expect(from).not.toHaveBeenCalled()
    fail = true
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('secret')
  })
})