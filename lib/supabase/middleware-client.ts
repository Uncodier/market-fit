import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  EXPIRED_COOKIE_OPTIONS,
  isInvalidRefreshTokenError,
  isSupabaseAuthCookieName,
} from '@/lib/supabase/auth-cookies'

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
    }
  )
}

export async function getMiddlewareUser(
  request: NextRequest,
  response: NextResponse
): Promise<{ user: { id: string } | null }> {
  const supabase = createMiddlewareSupabase(request, response)

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(request, response)
      return { user: null }
    }

    return { user: user ?? null }
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(request, response)
    }
    return { user: null }
  }
}
