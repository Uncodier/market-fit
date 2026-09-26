/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST, maxDuration } from '@/app/api/robots/instance/assistant/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { acquireOperationLease } from '@/lib/redis/operation-lease'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
jest.mock('@/lib/redis/operation-lease', () => ({
  acquireOperationLease: jest.fn(), releaseLeasesWithStream: (stream: ReadableStream) => stream,
}))

const previousUrl = process.env.API_SERVER_URL
const previousKey = process.env.SERVICE_API_KEY
beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'http://localhost:3001'
  delete process.env.SERVICE_API_KEY
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({ userId: 'verified-user', role: 'owner' })
  ;(acquireOperationLease as jest.Mock).mockResolvedValue({ release: jest.fn() })
})
afterAll(() => {
  if (previousUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = previousUrl
  if (previousKey === undefined) delete process.env.SERVICE_API_KEY
  else process.env.SERVICE_API_KEY = previousKey
})

function request(body = JSON.stringify({ site_id: 'site', user_id: 'forged-user', message: 'hello' })) {
  return new NextRequest('http://localhost:3000/api/robots/instance/assistant', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' }, body,
  })
}

it('preserves authenticated SSE bytes/metadata and uses a stream-length execution lease', async () => {
  const bytes = 'event: error\ndata: {"success":false,"error":{"message":"Failed safely"}}\n\n'
  ;(fetch as jest.Mock).mockResolvedValue(new Response(bytes, { headers: {
    'content-type': 'text/event-stream', 'x-assistant-stream-version': '1', 'x-workflow-run-id': 'run',
  } }))
  const result = await POST(request())
  expect(maxDuration).toBe(800)
  expect(result.headers.get('x-assistant-stream-version')).toBe('1')
  expect(result.headers.get('x-workflow-run-id')).toBe('run')
  expect(await result.text()).toBe(bytes)
  expect(acquireOperationLease).toHaveBeenCalledWith('assistant-execution', 'site', 815_000)
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, options] = (fetch as jest.Mock).mock.calls[0]
  expect(url.toString()).toBe('http://localhost:3001/api/robots/instance/assistant')
  expect(JSON.parse(options.body).user_id).toBe('verified-user')
  expect(options.headers.get('authorization')).toBe('Bearer test-token')
})

it.each([401, 403])('does not forward requests rejected by site authorization (%s)', async status => {
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({ error: NextResponse.json({ error: 'Denied' }, { status }) })
  expect((await POST(request())).status).toBe(status)
  expect(fetch).not.toHaveBeenCalled()
  expect(acquireOperationLease).not.toHaveBeenCalled()
})

it('rejects malformed input before auth or upstream execution', async () => {
  expect((await POST(request('{'))).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
  expect(requireSiteAccess).not.toHaveBeenCalled()
})