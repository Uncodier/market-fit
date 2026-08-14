import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_SITE_COOKIE } from '@/lib/auth/current-site-cookie'
import {
  firstAllowedNavHref,
  getNavKeyForPath,
  isAlwaysAllowedPath,
  isScreenBlocked,
} from '@/lib/auth/screen-access'
import { createMiddlewareSupabase } from '@/lib/supabase/middleware-client'

function isDemoSiteId(siteId: string): boolean {
  return siteId.startsWith('demo-')
}

export async function resolveBlockedScreenRedirect(
  request: NextRequest,
  sessionResponse: NextResponse,
  userId: string
): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl
  if (isAlwaysAllowedPath(pathname)) return null

  const siteId = request.cookies.get(CURRENT_SITE_COOKIE)?.value
  if (!siteId || isDemoSiteId(siteId)) return null

  const navKey = getNavKeyForPath(pathname, searchParams)
  if (!navKey) return null

  const supabase = createMiddlewareSupabase(request, sessionResponse)
  const { data: membership } = await supabase
    .from('site_members')
    .select('role, blocked_screens')
    .eq('site_id', siteId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  let role = membership?.role as string | null | undefined
  const blockedScreens = (membership?.blocked_screens || []) as string[]

  if (!membership) {
    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .maybeSingle()
    if (site?.user_id === userId) role = 'owner'
  }

  if (!isScreenBlocked(role, blockedScreens, navKey)) return null

  const destination = firstAllowedNavHref(role, blockedScreens)
  if (destination === pathname || request.nextUrl.pathname + request.nextUrl.search === destination) {
    return NextResponse.redirect(new URL('/profile', request.url))
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
