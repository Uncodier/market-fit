/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { POST, maxDuration } from '@/app/api/robots/instance/assistant/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { acquireOperationLeaseResult } from '@/lib/redis/operation-lease'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
jest.mock('@/lib/redis/operation-lease', () => ({
  ...jest.requireActual('@/lib/redis/operation-lease'),
  acquireOperationLeaseResult: jest.fn(),
}))

const previousUrl = process.env.API_SERVER_URL
const previousKey = process.env.SERVICE_API_KEY
const release = jest.fn().mockResolvedValue(undefined)
beforeEach(() => {
  jest.resetAllMocks()
  release.mockResolvedValue(undefined)
  process.env.API_SERVER_URL = 'http://localhost:3001'
  delete process.env.SERVICE_API_KEY
  ;(requireSiteAccess as jest.Mock).mockResolvedValue({ userId: 'verified-user', role: 'owner' })
  ;(acquireOperationLeaseResult as jest.Mock).mockResolvedValue({ status: 'acquired', lease: { release } })
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
  expect(acquireOperationLeaseResult).toHaveBeenCalledWith('assistant-execution', 'site', 815_000, 1, { renewAutomatically: false })
  expect(release).toHaveBeenCalledTimes(2)
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
  expect(acquireOperationLeaseResult).not.toHaveBeenCalled()
})

it('rejects malformed input before auth or upstream execution', async () => {
  expect((await POST(request('{'))).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each([
  ['contended', 409, 'ASSISTANT_EXECUTION_BUSY'],
  ['unavailable', 503, 'ASSISTANT_ADMISSION_UNAVAILABLE'],
])('distinguishes %s admission without starting work', async (status, httpStatus, code) => {
  ;(acquireOperationLeaseResult as jest.Mock).mockResolvedValueOnce({ status })
  const result = await POST(request())
  expect(result.status).toBe(httpStatus)
  expect(result.headers.get('retry-after')).toBe('5')
  expect(await result.json()).toMatchObject({ success: false, execution_started: false, error: { code } })
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['contended', 'unavailable'])('releases instance admission if global admission is %s', async status => {
  ;(acquireOperationLeaseResult as jest.Mock)
    .mockResolvedValueOnce({ status: 'acquired', lease: { release } })
    .mockResolvedValueOnce({ status })
  const result = await POST(request())
  expect(result.status).toBe(503)
  expect(release).toHaveBeenCalledTimes(1)
  expect(fetch).not.toHaveBeenCalled()
})

it('releases both leases on an upstream startup failure', async () => {
  ;(fetch as jest.Mock).mockRejectedValue(new Error('offline'))
  expect((await POST(request())).status).toBe(502)
  expect(release).toHaveBeenCalledTimes(2)
})

it('disconnects upstream and releases both leases even when upstream cancellation stalls', async () => {
  const cancel = jest.fn(() => new Promise<void>(() => {}))
  ;(fetch as jest.Mock).mockResolvedValue(new Response(new ReadableStream({ cancel })))
  const result = await POST(request())
  await result.body!.cancel()
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(release).toHaveBeenCalledTimes(2)
  expect((fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true)
})

it('bounds a stalled response independently of upstream headers and platform limits', async () => {
  jest.useFakeTimers()
  try {
    ;(fetch as jest.Mock).mockResolvedValue(new Response(new ReadableStream()))
    const result = await POST(request())
    const pending = result.text()
    const assertion = expect(pending).rejects.toThrow('Response stream timed out')
    await jest.advanceTimersByTimeAsync(790_000)
    await assertion
    expect(release).toHaveBeenCalledTimes(2)
    expect((fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
  } finally { jest.useRealTimers() }
})

it('includes authorization time in the overall response budget', async () => {
  jest.useFakeTimers()
  try {
    ;(requireSiteAccess as jest.Mock).mockImplementation(async () => {
      jest.setSystemTime(Date.now() + 30_000)
      return { userId: 'verified-user', role: 'owner' }
    })
    ;(fetch as jest.Mock).mockResolvedValue(new Response(new ReadableStream()))
    const result = await POST(request())
    const assertion = expect(result.text()).rejects.toThrow('Response stream timed out')
    await jest.advanceTimersByTimeAsync(760_000)
    await assertion
    expect(release).toHaveBeenCalledTimes(2)
    expect(jest.getTimerCount()).toBe(0)
  } finally { jest.useRealTimers() }
})