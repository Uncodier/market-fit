import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  EXPIRED_COOKIE_OPTIONS,
  isInvalidRefreshTokenError,
  isSupabaseAuthCookieName,
} from '@/lib/supabase/auth-cookies'
import { middlewareFetch } from '@/lib/supabase/middleware-fetch'
import { isAbortError } from '@/lib/supabase/postgrest-error'

export type MiddlewareUserLookup = {
  user: { id: string } | null
  lookupFailed: boolean
}

export function copyResponseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
  return to
}

export function clearSupabaseCookies(request: NextRequest, response: NextResponse): void {
  for (const cookie of request.cookies.getAll()) {
    if (!isSupabaseAuthCookieName(cookie.name)) continue
    request.cookies.delete(cookie.name)
    response.cookies.set(cookie.name, '', EXPIRED_COOKIE_OPTIONS)
  }
}

export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => isSupabaseAuthCookieName(cookie.name))
}

export function isTransientAuthLookupError(error: unknown): boolean {
  if (isAbortError(error)) return true
  if (!error || typeof error !== 'object') return false
  const status = Number((error as { status?: unknown }).status)
  if (status >= 500 || status === 408 || status === 429) return true
  const name = `${(error as { name?: unknown }).name || ''}`
  const message = `${(error as { message?: unknown }).message || ''}`.toLowerCase()
  if (name === 'TypeError' && message.includes('fetch')) return true
  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('econnrefused')
  )
}

export function createMiddlewareSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
      global: {
        fetch: middlewareFetch,
      },
    }
  )
}

export async function getMiddlewareUser(
  request: NextRequest,
  response: NextResponse
): Promise<MiddlewareUserLookup> {
  if (!hasSupabaseAuthCookie(request)) {
    return { user: null, lookupFailed: false }
  }

  const supabase = createMiddlewareSupabase(request, response)

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(request, response)
      return { user: null, lookupFailed: false }
    }

    if (error && !user && isTransientAuthLookupError(error)) {
      console.warn('middleware auth lookup failed open', {
        status: (error as { status?: unknown }).status,
      })
      return { user: null, lookupFailed: true }
    }

    return { user: user ?? null, lookupFailed: false }
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(request, response)
      return { user: null, lookupFailed: false }
    }
    console.warn('middleware auth lookup timed out')
    return { user: null, lookupFailed: true }
  }
}
