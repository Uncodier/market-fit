/** @jest-environment node */

import { GET, POST, DELETE } from '@/app/api/finder/[...path]/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
jest.mock('next/server', () => ({ NextResponse: {
  json: (body: unknown, init: ResponseInit) => Response.json(body, init),
} }))

const siteId = '00000000-0000-4000-8000-000000000001'
const icpId = '00000000-0000-4000-8000-000000000002'
const apiOrigin = 'http://localhost:3001'
const appOrigin = 'http://localhost:3000'
const auth = { getSession: jest.fn() }
const originalApiUrl = process.env.API_SERVER_URL
const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL

function request(path: string, method = 'GET', options: { body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`${appOrigin}/api/finder/${path}`, {
    method,
    headers: { cookie: 'sb-test=session', origin: appOrigin, ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers },
    ...(options.body ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) } : {}),
  })
}

function context(...path: string[]) {
  return { params: Promise.resolve({ path }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = apiOrigin
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({ userId: 'user-1', supabase: { auth } })
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' }, access_token: 'current-user-token' } }, error: null })
  ;(fetch as jest.Mock).mockReset().mockImplementation(async () =>
    Response.json({ success: true, data: { role_query: { query: { role_title: 'Founder' } } } }))
})

afterAll(() => {
  if (originalApiUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApiUrl
  if (originalPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApiUrl
})

it('opens a saved list through the same-origin route using the validated user session', async () => {
  const response = await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))

  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.json()).toEqual({ success: true, data: { role_query: { query: { role_title: 'Founder' } } } })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
  expect(fetch).toHaveBeenCalledWith(new URL(`${apiOrigin}/api/finder/icp?icp_id=${icpId}&site_id=${siteId}`), expect.objectContaining({
    method: 'GET', cache: 'no-store', redirect: 'error',
    headers: expect.objectContaining({ Authorization: 'Bearer current-user-token' }),
  }))
  expect((fetch as jest.Mock).mock.calls[0][1].headers).not.toHaveProperty('x-api-key')
})

it('forwards autocomplete, search, totals and query creation with site checks', async () => {
  const lookup = await GET(request(`autocomplete/industries?q=Sales%20%26%20Marketing&page=0&site_id=${siteId}`), context('autocomplete', 'industries'))
  expect(lookup.status).toBe(200)
  expect((fetch as jest.Mock).mock.calls[0][0].toString()).toBe(`${apiOrigin}/api/finder/autocomplete/industries?q=Sales+%26+Marketing&page=0&site_id=${siteId}`)

  for (const path of ['person_role_search', 'person_role_search/totals', 'person_role_search/createQuery']) {
    const payload = { site_id: siteId, person_name: ['Ada'], page: 0 }
    const response = await POST(request(path, 'POST', { body: payload }), context(...path.split('/')))
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenLastCalledWith(new URL(`${apiOrigin}/api/finder/${path}`), expect.objectContaining({
      method: 'POST', body: JSON.stringify(payload),
      headers: expect.objectContaining({ Authorization: 'Bearer current-user-token' }),
    }))
  }
  expect(requireSiteAccess).toHaveBeenCalledTimes(4)
})

it('deletes a saved list without leaking backend credentials or user cookies', async () => {
  const response = await DELETE(request(`icp?icp_id=${icpId}&site_id=${siteId}`, 'DELETE'), context('icp'))
  expect(response.status).toBe(200)
  expect((fetch as jest.Mock).mock.calls[0][1].headers).toEqual({
    Authorization: 'Bearer current-user-token', Accept: 'application/json',
  })
})

it('rejects unrecognized routes, methods, malformed IDs and cross-site origins', async () => {
  expect((await GET(request(`other?site_id=${siteId}`), context('other'))).status).toBe(404)
  expect((await GET(request(`icp?icp_id=bad&site_id=${siteId}`), context('icp'))).status).toBe(400)
  expect((await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}&site_id=${siteId}`), context('icp'))).status).toBe(400)
  expect((await GET(request(`autocomplete/industries?q=hello&page=0&site_id=${siteId}`, 'GET', { headers: { origin: 'https://evil.example' } }), context('autocomplete', 'industries'))).status).toBe(403)
  expect((await POST(request('icp', 'POST', { body: { site_id: siteId } }), context('icp'))).status).toBe(404)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not forward missing or unauthorized sessions, even with a site_id supplied', async () => {
  ;(requireSiteAccess as jest.Mock).mockResolvedValueOnce({ error: Response.json({ error: 'Unauthorized' }, { status: 401 }) })
    .mockResolvedValueOnce({ error: Response.json({ error: 'Forbidden' }, { status: 403 }) })
  expect((await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))).status).toBe(401)
  expect((await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))).status).toBe(403)
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'other-user' }, access_token: 'wrong' } }, error: null })
  expect((await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it('preserves upstream access errors without exposing its response or using a privileged key', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce(Response.json({ error: { message: 'private backend detail' } }, { status: 403 }))
  const response = await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain('private backend detail')
  expect((fetch as jest.Mock).mock.calls[0][1].headers).not.toHaveProperty('x-api-key')
})

it('does not treat a malformed successful backend response as an empty saved list', async () => {
  ;(fetch as jest.Mock).mockResolvedValueOnce(new Response('not-json', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
  const response = await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ success: false, error: { message: 'Finder API returned an invalid response' } })
})

it('rejects arbitrary API URLs and refuses to proxy onto the web app itself', async () => {
  for (const url of ['http://evil.example', `${appOrigin}`, 'https://user:password@api.example.com', 'https://api.example.com?target=evil']) {
    process.env.API_SERVER_URL = url
    expect((await GET(request(`icp?icp_id=${icpId}&site_id=${siteId}`), context('icp'))).status).toBe(503)
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('bounds request bodies and rejects invalid payloads before contacting the backend', async () => {
  expect((await POST(request('person_role_search', 'POST', { body: { site_id: 'someone-else' } }), context('person_role_search'))).status).toBe(400)
  expect((await POST(request('person_role_search', 'POST', { body: '{' }), context('person_role_search'))).status).toBe(400)
  expect((await POST(request('person_role_search', 'POST', { body: { site_id: siteId, data: 'x'.repeat(128_001) } }), context('person_role_search'))).status).toBe(413)
  expect(fetch).not.toHaveBeenCalled()
})