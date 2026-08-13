import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import {
  EXPIRED_COOKIE_OPTIONS,
  isSupabaseAuthCookieName,
} from '@/lib/supabase/auth-cookies'

export const dynamic = 'force-dynamic'

const EXTRA_COOKIES_TO_CLEAR = [
  'sb-access-token',
  'sb-refresh-token',
  'supabase-auth-token',
  'sb-provider-token',
  'sb-auth-token',
  'market_fit_demo_site_id',
]

function expireCookie(response: NextResponse, name: string) {
  response.cookies.set(name, '', EXPIRED_COOKIE_OPTIONS)
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/auth', request.url), 302)
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('Pragma', 'no-cache')

  try {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Session may already be invalid (expired/missing refresh token).
  }

  const cookieStore = await cookies()
  const seen = new Set<string>()

  for (const cookie of cookieStore.getAll()) {
    if (isSupabaseAuthCookieName(cookie.name) || EXTRA_COOKIES_TO_CLEAR.includes(cookie.name)) {
      expireCookie(response, cookie.name)
      seen.add(cookie.name)
    }
  }

  for (const name of EXTRA_COOKIES_TO_CLEAR) {
    if (!seen.has(name)) expireCookie(response, name)
  }

  return response
}
