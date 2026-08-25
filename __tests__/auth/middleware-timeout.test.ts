/**
 * @jest-environment node
 */
import { CURRENT_SITE_COOKIE } from '@/lib/auth/current-site-cookie'
import { resolveBlockedScreenRedirect } from '@/lib/auth/enforce-screen-access'
import { isServerActionRequest } from '@/lib/navigation/is-server-action'
import {
  getMiddlewareUser,
  hasSupabaseAuthCookie,
  isTransientAuthLookupError,
} from '@/lib/supabase/middleware-client'
import { createMiddlewareFetch } from '@/lib/supabase/middleware-fetch'
import type { NextRequest, NextResponse } from 'next/server'

function hangingFetch(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    const abort = () => {
      const error = new Error('This operation was aborted')
      error.name = 'AbortError'
      reject(error)
    }
    if (init?.signal?.aborted) {
      abort()
      return
    }
    init?.signal?.addEventListener('abort', abort, { once: true })
  })
}

function mockRequest(overrides?: {
  cookies?: { name: string; value: string }[]
  headers?: Record<string, string>
  pathname?: string
}): NextRequest {
  const cookies = overrides?.cookies ?? []
  const headers = overrides?.headers ?? {}
  return {
    cookies: {
      getAll: () => cookies,
      get: (name: string) => cookies.find((cookie) => cookie.name === name),
    },
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    nextUrl: {
      pathname: overrides?.pathname ?? '/pos',
      searchParams: new URLSearchParams(),
    },
  } as unknown as NextRequest
}

describe('isServerActionRequest', () => {
  it('detects Next.js server action POSTs', () => {
    expect(isServerActionRequest({ get: () => null })).toBe(false)
    expect(
      isServerActionRequest({
        get: (name) => (name === 'next-action' ? 'abc123' : null),
      })
    ).toBe(true)
  })
})

describe('isTransientAuthLookupError', () => {
  it('treats aborts, 5xx, and fetch failures as retryable', () => {
    expect(isTransientAuthLookupError({ name: 'AbortError' })).toBe(true)
    expect(isTransientAuthLookupError({ name: 'TimeoutError' })).toBe(true)
    expect(isTransientAuthLookupError({ status: 522, message: 'Connection timed out' })).toBe(true)
    expect(isTransientAuthLookupError({ name: 'TypeError', message: 'fetch failed' })).toBe(true)
    expect(isTransientAuthLookupError({ code: 'refresh_token_not_found' })).toBe(false)
  })
})

describe('createMiddlewareFetch', () => {
  it('aborts hung upstream requests before the edge timeout', async () => {
    const fetchWithTimeout = createMiddlewareFetch(20, hangingFetch)
    await expect(fetchWithTimeout('https://db.makinari.com/auth/v1/token')).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('getMiddlewareUser', () => {
  it('skips the auth network call when there is no session cookie', async () => {
    const request = mockRequest()
    expect(hasSupabaseAuthCookie(request)).toBe(false)
    const result = await getMiddlewareUser(request, {} as NextResponse)
    expect(result).toEqual({ user: null, lookupFailed: false })
  })
})

describe('resolveBlockedScreenRedirect', () => {
  it('does not query membership for server actions', async () => {
    const request = mockRequest({
      pathname: '/pos',
      headers: { 'next-action': 'abc123' },
      cookies: [
        {
          name: CURRENT_SITE_COOKIE,
          value: '11111111-1111-4111-8111-111111111111',
        },
      ],
    })
    const result = await resolveBlockedScreenRedirect(
      request,
      {} as NextResponse,
      '22222222-2222-4222-8222-222222222222'
    )
    expect(result).toBeNull()
  })
})
