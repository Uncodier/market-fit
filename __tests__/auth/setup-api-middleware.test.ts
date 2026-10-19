/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server'
import { middleware } from '@/app/middleware'
import { GET, POST } from '@/app/api/site/setup/route'
import { enforceApiAdmission } from '@/lib/redis/api-admission'
import { getMiddlewareUser } from '@/lib/supabase/middleware-client'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/redis/api-admission', () => ({ enforceApiAdmission: jest.fn() }))
jest.mock('@/lib/supabase/middleware-client', () => ({
  copyResponseCookies: jest.fn(), getMiddlewareUser: jest.fn(),
}))
jest.mock('@/lib/auth/enforce-screen-access', () => ({ resolveBlockedScreenRedirect: jest.fn() }))
jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))

const siteId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const workflowId = `site-setup-${siteId}-1791331200000`
const apiUrl = process.env.API_SERVER_URL
const rpc = jest.fn()
const getSession = jest.fn()
const request = (pathname = '/api/site/setup', method = 'POST') =>
  new NextRequest(`https://app.makinari.com${pathname}`, {
    method, headers: { origin: 'https://app.makinari.com', cookie: 'session', 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ site_id: siteId }) } : {}),
  })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'https://api.example.test'
  jest.mocked(enforceApiAdmission).mockReset().mockResolvedValue(null)
  rpc.mockResolvedValue({ data: true, error: null })
  getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-user-token', user: { id: userId } } }, error: null })
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, role: 'owner', userEmail: null,
    supabase: { auth: { getSession }, rpc } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>['supabase'] & {},
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, data: {
    workflow_id: workflowId, site_id: siteId, status: 'accepted', setup_status: 'pending', cause: 'WORKFLOW_ACCEPTED',
  } }))
})

afterAll(() => {
  if (apiUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = apiUrl
})

it.each(['/api/site/setup', '/api/site/setup/', '/api/stripe/auto-top-up/setup', '/api/stripe/auto-top-up/setup/'])(
  'admits the exact authenticated setup API %s without middleware authentication', async pathname => {
    const req = request(pathname)
    const response = await middleware(req)
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(enforceApiAdmission).toHaveBeenCalledWith(req)
    expect(getMiddlewareUser).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

it('allows the complete setup launch boundary to return its workflow ID', async () => {
  const req = request()
  const admission = await middleware(req)
  expect(admission.headers.get('x-middleware-next')).toBe('1')
  const response = await POST(req)
  expect(response.status).toBe(200)
  expect((await response.json()).data).toMatchObject({ workflow_id: workflowId, setup_status: 'pending' })
  expect(requireSiteAccess).toHaveBeenCalledWith(req, siteId, { requireManager: true })
  expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: siteId, p_command: 'update' })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('admits manual workflow status reads without starting another workflow', async () => {
  const req = request(`/api/site/setup?workflow_id=${workflowId}`, 'GET')
  expect((await middleware(req)).headers.get('x-middleware-next')).toBe('1')
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, data: {
    workflow_id: workflowId, site_id: siteId, status: 'running', setup_status: 'pending', cause: 'WORKFLOW_RUNNING',
  } }))
  const response = await GET(req)
  expect(response.status).toBe(200)
  expect((await response.json()).data.workflow_id).toBe(workflowId)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][1]?.method).toBe('GET')
  expect(jest.mocked(fetch).mock.calls[0][1]?.body).toBeUndefined()
})

it.each([401, 403])('retains route-level authentication/authorization denial (%i)', async status => {
  const req = request()
  expect((await middleware(req)).headers.get('x-middleware-next')).toBe('1')
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: NextResponse.json({ error: 'Denied' }, { status }) })
  expect((await POST(req)).status).toBe(status)
  expect(fetch).not.toHaveBeenCalled()
})

it('retains API admission limits for legitimate setup endpoints', async () => {
  jest.mocked(enforceApiAdmission).mockResolvedValueOnce(NextResponse.json({ error: 'Rate limited' }, { status: 429 }))
  const response = await middleware(request())
  expect(response.status).toBe(429)
  expect(response.headers.get('x-middleware-next')).toBeNull()
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('retains route-level input and cross-origin validation after middleware admission', async () => {
  const invalid = new NextRequest('https://app.makinari.com/api/site/setup', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"site_id":"invalid"}',
  })
  expect((await middleware(invalid)).headers.get('x-middleware-next')).toBe('1')
  expect((await POST(invalid)).status).toBe(400)
  const crossOrigin = new NextRequest('https://app.makinari.com/api/site/setup', {
    method: 'POST', headers: { origin: 'https://foreign.example.test', 'content-type': 'application/json' },
    body: JSON.stringify({ site_id: siteId }),
  })
  expect((await middleware(crossOrigin)).headers.get('x-middleware-next')).toBe('1')
  expect((await POST(crossOrigin)).status).toBe(403)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  '/setup', '/setup.php', '/api/setup', '/api/site/setup.php', '/api/site/setup-extra',
  '/api/site/setup/admin', '/api/site/SETUP', '/api/site/setup//', '/api/site/setup/..%2fprobe',
  '/api/stripe/auto-top-up/setup.php', '/api/stripe/auto-top-up/setup-extra',
  '/api/stripe/auto-top-up/setup/install', '/api/site/install', '/wp-admin', '/.env', '/.git/config',
])('still blocks scanner paths and setup-prefix lookalikes: %s', async pathname => {
  const response = await middleware(request(pathname))
  expect(response.status).toBe(404)
  expect(response.headers.get('x-middleware-next')).toBeNull()
  expect(enforceApiAdmission).not.toHaveBeenCalled()
  expect(getMiddlewareUser).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})