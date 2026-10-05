/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_SITE_COOKIE } from '@/lib/auth/current-site-cookie'
import { resolveBlockedScreenRedirect } from '@/lib/auth/enforce-screen-access'
import { getMiddlewareUser } from '@/lib/supabase/middleware-client'

// These tests use the installed SSR, auth-js and PostgREST SDKs, not mocked clients.
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SITE_ID = '11111111-1111-4111-8111-111111111111'
const AUTH_COOKIE = 'sb-middleware-auth-token'
const originalFetch = global.fetch
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function session(expired = false) {
  return {
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    expires_in: 3600,
    user: { id: USER_ID },
  }
}

function request(expired = false): NextRequest {
  const req = new NextRequest('https://app.test/pos')
  req.cookies.set(AUTH_COOKIE, `base64-${Buffer.from(JSON.stringify(session(expired))).toString('base64url')}`)
  req.cookies.set(CURRENT_SITE_COOKIE, SITE_ID)
  req.cookies.set('unrelated', 'preserved')
  return req
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' },
  })
}

function installTransport(implementation: typeof fetch) {
  const transport = jest.fn(implementation)
  global.fetch = transport
  return transport
}

describe('middleware real Supabase SDK deadlines', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://middleware.supabase.test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key'
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    // Auth-js has no cancellation API for its internal exponential-backoff sleep.
    // Drain it and assert the transport gate prevents every late network attempt.
    await jest.advanceTimersByTimeAsync(60_000)
    expect(jest.getTimerCount()).toBe(0)
    jest.restoreAllMocks()
    jest.useRealTimers()
    global.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
  })

  it('verifies normal auth against the server and releases the deadline timer', async () => {
    const transport = installTransport(async () => json({ id: USER_ID }))
    const response = NextResponse.next()
    await expect(getMiddlewareUser(request(), response)).resolves.toEqual({
      user: { id: USER_ID }, lookupFailed: false,
    })
    expect(String(transport.mock.calls[0][0])).toContain('/auth/v1/user')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(response.cookies.getAll()).toEqual([])
    expect(jest.getTimerCount()).toBe(0)
  })

  it('refreshes normally and forwards refreshed cookies before disposal', async () => {
    const transport = installTransport(async (input) =>
      json(String(input).includes('/token') ? session() : { id: USER_ID })
    )
    const req = request(true)
    const previousCookie = req.cookies.get(AUTH_COOKIE)?.value
    const response = NextResponse.next()
    await expect(getMiddlewareUser(req, response)).resolves.toMatchObject({
      user: { id: USER_ID }, lookupFailed: false,
    })
    expect(transport).toHaveBeenCalledTimes(2)
    expect(response.cookies.get(AUTH_COOKIE)).toBeDefined()
    expect(req.cookies.get(AUTH_COOKIE)?.value).not.toBe(previousCookie)
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(['refresh_token_not_found', 'refresh_token_already_used'])(
    'clears invalid refresh cookies (%s) without failing open', async (code) => {
      const transport = installTransport(async () => json({ code, message: 'Invalid Refresh Token' }, 400))
      const req = request(true)
      req.cookies.set('sb-other-auth-token.0', 'synthetic-chunk')
      const response = NextResponse.next()
      await expect(getMiddlewareUser(req, response)).resolves.toEqual({ user: null, lookupFailed: false })
      expect(req.cookies.get(AUTH_COOKIE)).toBeUndefined()
      expect(req.cookies.get('sb-other-auth-token.0')).toBeUndefined()
      expect(req.cookies.get('unrelated')?.value).toBe('preserved')
      expect(response.cookies.get(AUTH_COOKIE)?.maxAge).toBe(0)
      expect(transport).toHaveBeenCalledTimes(1)
    }
  )

  it('does not treat an invalid access token as a transient network failure', async () => {
    installTransport(async () => json({ code: 'bad_jwt', message: 'Invalid JWT' }, 401))
    await expect(getMiddlewareUser(request(), NextResponse.next())).resolves.toEqual({
      user: null, lookupFailed: false,
    })
  })

  it('treats SDK-wrapped status-zero aborts as transient without deleting cookies', async () => {
    installTransport(async () => { throw new DOMException('The operation was aborted', 'AbortError') })
    const req = request()
    const response = NextResponse.next()
    await expect(getMiddlewareUser(req, response)).resolves.toEqual({ user: null, lookupFailed: true })
    expect(req.cookies.get(AUTH_COOKIE)).toBeDefined()
    expect(response.cookies.getAll()).toEqual([])
  })

  it.each(['hung', '522'])(
    'bounds actual refresh retries (%s) to eight seconds and blocks late transport', async (mode) => {
      const signals: AbortSignal[] = []
      const transport = installTransport(async (_input, init) => {
        signals.push(init!.signal!)
        if (mode === '522') return json({ message: 'upstream unavailable' }, 522)
        return new Promise<Response>(() => {})
      })
      const req = request(true)
      const before = req.cookies.get(AUTH_COOKIE)?.value
      const response = NextResponse.next()
      let settled = false
      const pending = getMiddlewareUser(req, response).then((result) => { settled = true; return result })
      await jest.advanceTimersByTimeAsync(7_999)
      expect(settled).toBe(false)
      await jest.advanceTimersByTimeAsync(1)
      await expect(pending).resolves.toEqual({ user: null, lookupFailed: true })
      if (mode === '522') expect(transport.mock.calls.length).toBeGreaterThan(1)
      else expect(transport).toHaveBeenCalledTimes(1)
      expect(signals.every((signal) => signal.aborted)).toBe(true)
      const callsAtDeadline = transport.mock.calls.length
      await jest.advanceTimersByTimeAsync(60_000)
      expect(transport).toHaveBeenCalledTimes(callsAtDeadline)
      expect(req.cookies.get(AUTH_COOKIE)?.value).toBe(before)
      expect(response.cookies.getAll()).toEqual([])
    }
  )

  it('prevents late refresh body parsing from writing request or response cookies', async () => {
    let resolveBody!: (value: unknown) => void
    const transport = installTransport(async () => ({
      ok: true, status: 200, headers: new Headers(),
      json: () => new Promise((resolve) => { resolveBody = resolve }),
    }) as Response)
    const req = request(true)
    const before = req.cookies.getAll()
    const response = NextResponse.next()
    const pending = getMiddlewareUser(req, response)
    await jest.advanceTimersByTimeAsync(8_000)
    await expect(pending).resolves.toEqual({ user: null, lookupFailed: true })
    resolveBody(session())
    await jest.advanceTimersByTimeAsync(60_000)
    expect(req.cookies.getAll()).toEqual(before)
    expect(response.cookies.getAll()).toEqual([])
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('shares auth elapsed time with screen lookup and aborts the remaining two seconds', async () => {
    let screenSignal: AbortSignal | undefined | null
    const transport = installTransport(async (input, init) => {
      if (String(input).includes('/auth/v1/user')) {
        return new Promise<Response>((resolve) => setTimeout(() => resolve(json({ id: USER_ID })), 6_000))
      }
      screenSignal = init?.signal
      return new Promise<Response>(() => {})
    })
    const req = request()
    const response = NextResponse.next()
    const auth = getMiddlewareUser(req, response)
    await jest.advanceTimersByTimeAsync(6_000)
    await expect(auth).resolves.toMatchObject({ user: { id: USER_ID } })
    let settled = false
    const screen = resolveBlockedScreenRedirect(req, response, USER_ID).then((value) => {
      settled = true
      return value
    })
    await jest.advanceTimersByTimeAsync(1_999)
    expect(settled).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await expect(screen).resolves.toBeNull()
    expect(screenSignal?.aborted).toBe(true)
    await jest.advanceTimersByTimeAsync(60_000)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each([522, 403])('does not retry membership HTTP %s or query ownership after failure', async (status) => {
    const transport = installTransport(async () => json({ message: 'unavailable' }, status))
    await expect(resolveBlockedScreenRedirect(request(), NextResponse.next(), USER_ID)).resolves.toBeNull()
    await jest.advanceTimersByTimeAsync(60_000)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(String(transport.mock.calls[0][0])).toContain('/rest/v1/site_members')
  })

  it('does not retry membership network errors or query ownership afterward', async () => {
    const transport = installTransport(async () => { throw new TypeError('fetch failed') })
    await expect(resolveBlockedScreenRedirect(request(), NextResponse.next(), USER_ID)).resolves.toBeNull()
    await jest.advanceTimersByTimeAsync(60_000)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it.each(['collaborator', 'admin'])('preserves blocked screen behavior for %s', async (role) => {
    const transport = installTransport(async () => json([{ role, blocked_screens: ['pos'] }]))
    const result = await resolveBlockedScreenRedirect(request(), NextResponse.next(), USER_ID)
    if (role === 'admin') expect(result).toBeNull()
    else expect(result?.headers.get('location')).toMatch(/^https:\/\/app\.test\//)
    expect(transport).toHaveBeenCalledTimes(1)
    const url = new URL(String(transport.mock.calls[0][0]))
    expect(url.searchParams.get('site_id')).toBe(`eq.${SITE_ID}`)
    expect(url.searchParams.get('user_id')).toBe(`eq.${USER_ID}`)
    expect(url.searchParams.get('status')).toBe('eq.active')
    expect(jest.getTimerCount()).toBe(0)
  })

  it('queries ownership only after successful empty membership and bounds both queries', async () => {
    const transport = installTransport(async (input) => {
      if (String(input).includes('/site_members')) {
        return new Promise<Response>((resolve) => setTimeout(() => resolve(json([])), 7_000))
      }
      return new Promise<Response>(() => {})
    })
    const pending = resolveBlockedScreenRedirect(request(), NextResponse.next(), USER_ID)
    await jest.advanceTimersByTimeAsync(7_000)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(String(transport.mock.calls[1][0])).toContain('/rest/v1/sites')
    await jest.advanceTimersByTimeAsync(1_000)
    await expect(pending).resolves.toBeNull()
    expect(transport.mock.calls[1][1]?.signal?.aborted).toBe(true)
  })

  it('allows an owner after a successful empty membership lookup', async () => {
    const transport = installTransport(async (input) =>
      json(String(input).includes('/site_members') ? [] : [{ user_id: USER_ID }])
    )
    await expect(resolveBlockedScreenRedirect(request(), NextResponse.next(), USER_ID)).resolves.toBeNull()
    expect(transport).toHaveBeenCalledTimes(2)
    const url = new URL(String(transport.mock.calls[1][0]))
    expect(url.searchParams.get('id')).toBe(`eq.${SITE_ID}`)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('does not query ownership after membership body decoding exceeds the deadline', async () => {
    let resolveBody!: (value: string) => void
    const transport = installTransport(async () => ({
      ok: true, status: 200, headers: new Headers(),
      text: () => new Promise((resolve) => { resolveBody = resolve }),
    }) as Response)
    const pending = resolveBlockedScreenRedirect(request(), NextResponse.next(), USER_ID)
    await jest.advanceTimersByTimeAsync(8_000)
    await expect(pending).resolves.toBeNull()
    resolveBody('[]')
    await jest.advanceTimersByTimeAsync(60_000)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('does not start a screen lookup if auth used the entire shared budget', async () => {
    const transport = installTransport(async () => new Promise<Response>(() => {}))
    const req = request()
    const response = NextResponse.next()
    const auth = getMiddlewareUser(req, response)
    await jest.advanceTimersByTimeAsync(8_000)
    await expect(auth).resolves.toEqual({ user: null, lookupFailed: true })
    await expect(resolveBlockedScreenRedirect(req, response, USER_ID)).resolves.toBeNull()
    expect(transport).toHaveBeenCalledTimes(1)
  })
})