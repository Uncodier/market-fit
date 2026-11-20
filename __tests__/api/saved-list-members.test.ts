/** @jest-environment node */
import { GET } from '@/app/api/finder/lists/[id]/members/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { createServiceClient } from '@/lib/supabase/server'
import { listId, siteId, leadId } from '../app/people/saved-list-fixtures'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }))
const parent = jest.fn()
const range = jest.fn()
const completed = jest.fn()
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(), range, maybeSingle: parent }
const countQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => completed().then(resolve) }
const memberSelect = jest.fn()
const from = jest.fn()
const member = { person_id: '42', processing_status: 'completed', outcome: 'matched',
  leads: { id: leadId, site_id: siteId, name: 'Alice', position: 'Director', company: { name: 'Factory' } } }
const linked = { ...member, leads: { ...member.leads, profile: { id: 42, headline: 'Manufacturing',
  emails: ['private@example.test'], provider_responses: { confidential: true } } } }
function request(query = `site_id=${siteId}&page=1`) {
  return new Request(`https://app.example.test/api/finder/lists/${listId}/members?${query}`, { headers: { cookie: 'test=session' } })
}
const context = { params: Promise.resolve({ id: listId }) }
beforeEach(() => {
  jest.clearAllMocks()
  parent.mockReset().mockResolvedValue({ data: { id: listId, name: 'Manufactura', status: 'pending', icp_criteria: { source: 'selected_people' } }, error: null })
  range.mockReset().mockResolvedValue({ data: [linked], count: 129, error: null })
  completed.mockReset().mockResolvedValue({ data: null, count: 1, error: null })
  from.mockReset().mockImplementation(table => {
    if (table === 'icp_mining') return query
    if (table === 'icp_mining_people') return { select: memberSelect }
    throw new Error('Unexpected table')
  })
  memberSelect.mockImplementation((...args: unknown[]) => args[1] && (args[1] as { head?: boolean }).head ? countQuery : query)
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: 'actor', userEmail: null, role: 'owner', supabase: { from } } as never)
})

it('projects the authorized linked lead profile without a privileged read', async () => {
  const response = await GET(request(), context)
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data).toMatchObject({ id: listId, siteId, total: 129, completed: 1,
    members: [{ personId: '42', lead: { id: leadId }, result: { person: { id: '42', full_name: 'Alice', headline: 'Manufacturing' } } }] })
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(query.eq).toHaveBeenCalledWith('id', listId)
  expect(query.eq).toHaveBeenCalledWith('site_id', siteId)
  expect(range).toHaveBeenCalledWith(0, 24)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalledWith('persons')
  expect(JSON.stringify(data)).not.toMatch(/private@example|provider_responses|raw_result|site_id|confidential/)
})

it.each([401, 403])('never elevates when authentication or site authorization returns %s', async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: Response.json({ error: 'Denied' }, { status }) } as never)
  expect((await GET(request(), context)).status).toBe(status)
  expect(from).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('does not elevate for an RLS-hidden list, even when the site is visible', async () => {
  parent.mockResolvedValue({ data: null, error: null })
  expect((await GET(request(), context)).status).toBe(404)
  expect(range).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each(['site_id=bad', `site_id=${siteId}&page=0`, `site_id=${siteId}&page=1.5`,
  `site_id=${siteId}&page=1&page=2`, `site_id=${siteId}&site_id=${siteId}`, `site_id=${siteId}&person_ids=999`,
])('rejects malformed or caller-provided profile selection: %s', async params => {
  expect((await GET(request(params), context)).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('paginates membership without sending ordinals through JS numbers', async () => {
  expect((await GET(request(`site_id=${siteId}&page=2`), context)).status).toBe(200)
  expect(range).toHaveBeenCalledWith(25, 49)
  expect(memberSelect).toHaveBeenCalledWith(expect.not.stringContaining('ordinal,'), { count: 'exact' })
})

it('keeps opaque provider IDs and missing profiles visible without network enrichment', async () => {
  range.mockResolvedValue({ data: [{ ...member, person_id: 'provider:opaque', leads: null, processing_status: 'pending', outcome: null }], count: 1, error: null })
  completed.mockResolvedValue({ count: 0, error: null })
  const data = await (await GET(request(), context)).json()
  expect(data.members[0]).toMatchObject({ personId: 'provider:opaque', processing: 'pending', lead: null,
    result: { person: { full_name: 'provider:opaque' } } })
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('shows no inaccessible lead and does not discover unrelated leads by name or person', async () => {
  range.mockResolvedValue({ data: [{ ...member, leads: null }], count: 1, error: null })
  const data = await (await GET(request(), context)).json()
  expect(data.members[0].lead).toBeNull()
  expect(from).not.toHaveBeenCalledWith('leads')
})

it('does not resolve a numeric member ID against the private global profiles table', async () => {
  range.mockResolvedValue({ data: [{ ...member, leads: null }], count: 1, error: null })
  const data = await (await GET(request(), context)).json()
  expect(data.members[0].result.person).toMatchObject({ id: '42', full_name: '42' })
  expect(from).not.toHaveBeenCalledWith('persons')
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('reads appended members from filter-based lists under the same RLS checks', async () => {
  parent.mockResolvedValue({ data: { id: listId, name: 'Mixed list', status: 'pending', icp_criteria: { source: 'person_role_search' } }, error: null })
  const data = await (await GET(request(), context)).json()
  expect(data).toMatchObject({ name: 'Mixed list', members: [{ personId: '42', processing: 'completed' }] })
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each(['parent', 'member', 'count', 'foreign-lead'])('fails closed and redacts the %s failure', async failure => {
  if (failure === 'parent') parent.mockResolvedValue({ data: null, error: { message: 'secret database error' } })
  if (failure === 'member') range.mockResolvedValue({ data: null, count: null, error: { message: 'secret database error' } })
  if (failure === 'count') completed.mockResolvedValue({ count: null, error: null })
  if (failure === 'foreign-lead') range.mockResolvedValue({ data: [{ ...member, leads: { ...member.leads, site_id: listId } }], count: 1, error: null })
  const response = await GET(request(), context)
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('secret')
})