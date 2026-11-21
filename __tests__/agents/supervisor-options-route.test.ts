/** @jest-environment node */
import { GET } from '@/app/api/agents/supervisors/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { NextResponse } from 'next/server'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const self = id(2), parent = id(1), site = id(50)
const get = (agentId?: string, siteId = site) => GET(new Request(`https://app.example.test/api/agents/supervisors?siteId=${siteId}${agentId ? `&agentId=${agentId}` : ''}`))
const rows = [[parent, null], [self, parent], [id(3), self], [id(4), id(3)], [id(5), id(77)], [id(6), id(7)], [id(7), id(6)], [id(8), null]]
  .map(([key, supervisor]) => ({ id: key!, supervisor, role: 'Sales', name: 'Same name' }))
const read = jest.fn(), eq = jest.fn(), select = jest.fn()
const from = jest.fn(() => ({ select }))
beforeEach(() => {
  jest.clearAllMocks(); let offset = 0
  read.mockReset().mockImplementation(() => Promise.resolve({ data: rows.slice(offset, offset + 2), count: rows.length, error: null }))
  const query = { eq, order: () => query, range: (n: number) => { offset = n; return query }, abortSignal: read }
  eq.mockReturnValue(query); select.mockReturnValue(query)
  jest.mocked(requireSiteAccess).mockResolvedValue({ role: 'owner', userId: id(99), userEmail: null, supabase: { from } as never })
})

it('offers only persisted same-site candidates with rooted chains; current selection and duplicate names use UUIDs', async () => {
  const response = await get(self)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const data = await response.json()
  expect(data.agents.map((r: { id: string }) => r.id)).toEqual([parent, id(8)])
  expect(data.current).toEqual({ id: parent, role: 'Sales', name: 'Same name' })
  expect(read).toHaveBeenCalledTimes(4)
  expect(eq.mock.calls.every(args => args[0] === 'site_id' && args[1] === site)).toBe(true)
  expect(select).toHaveBeenCalledWith('id,name,role,supervisor', { count: 'exact' })
})

it('fails closed on partial results, hidden profiles, invalid IDs and unauthorized sites', async () => {
  read.mockResolvedValueOnce({ data: [], count: 1 })
  expect((await get(self)).status).toBe(503)
  expect((await get(id(100))).status).toBe(404)
  from.mockClear()
  expect((await get('role-name')).status).toBe(400)
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })
  expect((await get(self)).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
})