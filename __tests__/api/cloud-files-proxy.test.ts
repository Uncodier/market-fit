/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import { GET } from '@/app/api/robots/instance/[instanceId]/cloud-files/[fileId]/route'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const instanceId = randomUUID()
const fileId = randomUUID()
const userId = randomUUID()
const token = randomBytes(32).toString('hex')
const untrustedToken = randomBytes(32).toString('hex')
const cookie = randomBytes(24).toString('hex')
const apiOrigin = 'https://api.example.test'
const appOrigin = 'https://app.example.test'
const path = `/api/robots/instance/${instanceId}/cloud-files/${fileId}`
const auth = { getUser: jest.fn(), getSession: jest.fn() }
const originalApi = process.env.API_SERVER_URL

function request(query = 'version=2&format=zip', headers: Record<string, string> = {}) {
  return new Request(`${appOrigin}${path}?${query}`, {
    headers: { authorization: `Bearer ${untrustedToken}`, cookie, ...headers },
  })
}
function context(instance: string = instanceId, file: string = fileId) {
  return { params: Promise.resolve({ instanceId: instance, fileId: file }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = apiOrigin
  ;(createClient as jest.Mock).mockResolvedValue({ auth })
  auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: userId }, access_token: token } }, error: null })
  ;(fetch as jest.Mock).mockReset().mockResolvedValue(new Response(new Uint8Array([80, 75, 0, 255, 128]), {
    headers: { 'content-type': 'application/zip', 'set-cookie': cookie, 'x-private': token },
  }))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
})

it('preserves binary bytes and sends only the verified user token to the fixed scope', async () => {
  const response = await GET(request(), context())
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([80, 75, 0, 255, 128]))
  expect(createClient).toHaveBeenCalledWith(true)
  expect(auth.getUser.mock.invocationCallOrder[0]).toBeLessThan(auth.getSession.mock.invocationCallOrder[0])
  expect(fetch).toHaveBeenCalledWith(new URL(`${apiOrigin}${path}?version=2&format=zip`), expect.objectContaining({
    method: 'GET', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error',
  }))
  expect(response.headers.get('content-type')).toBe('application/zip')
  expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${fileId}-v2.zip"`)
  expect(response.headers.get('cache-control')).toContain('no-store')
  const headers = JSON.stringify([...response.headers])
  for (const sensitive of [token, untrustedToken, cookie]) expect(headers).not.toContain(sensitive)
})

it.each(['anonymous', 'invalid-user', 'missing-session', 'mismatch', 'expired'])('denies %s without upstream fetch', async mode => {
  if (mode === 'anonymous') auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  if (mode === 'invalid-user') auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: new Error(token) })
  if (mode === 'missing-session') auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  if (mode === 'mismatch') auth.getSession.mockResolvedValue({ data: { session: { user: { id: randomUUID() }, access_token: token } }, error: null })
  if (mode === 'expired') auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error(token) })
  expect((await GET(request(), context())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([401, 403, 404, 503])('preserves upstream scope denial %s without private body or headers', async status => {
  ;(fetch as jest.Mock).mockResolvedValue(new Response(token, { status, headers: { 'x-private': token } }))
  const response = await GET(request(), context())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain(token)
  expect(response.headers.get('x-private')).toBeNull()
})

it.each(['version=0&format=zip', 'version=-1&format=zip', 'version=1e2&format=zip',
  'version=2147483648&format=zip', 'version=1&version=2&format=zip', 'version=1&format=html',
  'version=1&format=zip&format=text', 'version=1&format=zip&url=https://evil.example.test',
  'version=1&format=zip&site_id=other', 'format=zip'])('rejects invalid query %s', async query => {
  expect((await GET(request(query), context())).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects path injection and cross-site requests', async () => {
  for (const id of ['../other', `${instanceId}/more`, 'not-a-uuid', `${instanceId}?url=x`]) {
    expect((await GET(request(), context(id))).status).toBe(400)
    expect((await GET(request(), context(instanceId, id))).status).toBe(400)
  }
  expect((await GET(request(undefined, { origin: 'https://other.example.test' }), context())).status).toBe(403)
  expect((await GET(request(undefined, { 'sec-fetch-site': 'cross-site' }), context())).status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})

it('refuses unsafe server configuration without exposing credentials', async () => {
  const authenticated = new URL(apiOrigin)
  authenticated.username = randomBytes(12).toString('hex')
  authenticated.password = randomBytes(24).toString('hex')
  for (const value of ['', appOrigin, 'http://api.example.test', `${apiOrigin}/unexpected`, authenticated.href]) {
    process.env.API_SERVER_URL = value
    const response = await GET(request(), context())
    expect(response.status).toBe(503)
    const body = await response.text()
    expect(body).not.toContain(authenticated.username)
    expect(body).not.toContain(authenticated.password)
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('serves text as an attachment, never active HTML', async () => {
  ;(fetch as jest.Mock).mockResolvedValue(new Response('<script>not executable</script>', { headers: { 'content-type': 'text/plain; charset=utf-8' } }))
  const response = await GET(request('version=2&format=text'), context())
  expect(await response.text()).toBe('<script>not executable</script>')
  expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
  expect(response.headers.get('content-security-policy')).toContain('sandbox')
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
})

it('bounds responses and rejects unexpected content or redirects without logging', async () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {})
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    for (const response of [new Response(token, { headers: { 'content-type': 'text/html' } }),
      new Response(new Uint8Array(1024 * 1024 + 1), { headers: { 'content-type': 'application/zip' } }),
      new Response(null, { status: 302, headers: { location: 'https://other.example.test' } })]) {
      ;(fetch as jest.Mock).mockResolvedValue(response)
      expect((await GET(request(), context())).status).toBe(502)
    }
    ;(fetch as jest.Mock).mockRejectedValue(new Error(token))
    const response = await GET(request(), context())
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain(token)
    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  } finally {
    log.mockRestore()
    error.mockRestore()
  }
})