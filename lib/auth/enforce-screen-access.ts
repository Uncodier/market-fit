import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_SITE_COOKIE } from '@/lib/auth/current-site-cookie'
import {
  firstAllowedNavHref,
  getNavKeyForPath,
  isAlwaysAllowedPath,
  isScreenBlocked,
} from '@/lib/auth/screen-access'
import { isServerActionRequest } from '@/lib/navigation/is-server-action'
import { createMiddlewareSupabase } from '@/lib/supabase/middleware-client'
import { createMiddlewareDeadline } from '@/lib/supabase/middleware-deadline'

function isDemoSiteId(siteId: string): boolean {
  return siteId.startsWith('demo-')
}

export async function resolveBlockedScreenRedirect(
  request: NextRequest,
  sessionResponse: NextResponse,
  userId: string
): Promise<NextResponse | null> {
  // Server Actions POST to the current page; screen gating is a navigation concern.
  if (isServerActionRequest(request.headers)) return null

  const { pathname, searchParams } = request.nextUrl
  if (isAlwaysAllowedPath(pathname)) return null

  const siteId = request.cookies.get(CURRENT_SITE_COOKIE)?.value
  if (!siteId || isDemoSiteId(siteId)) return null

  const navKey = getNavKeyForPath(pathname, searchParams)
  if (!navKey) return null

  const deadline = createMiddlewareDeadline(request)
  try {
    return await deadline.wait(async () => {
      const supabase = createMiddlewareSupabase(request, sessionResponse, deadline)
      const { data: membership, error: membershipError } = await supabase
        .from('site_members')
        .select('role, blocked_screens')
        .eq('site_id', siteId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .retry(false)
        .abortSignal(deadline.signal)
        .maybeSingle()

      // A failed membership lookup is not evidence that a membership is absent.
      if (membershipError) return null
      deadline.assertActive()

      let role = membership?.role as string | null | undefined
      const blockedScreens = (membership?.blocked_screens || []) as string[]

      if (!membership) {
        const { data: site, error: siteError } = await supabase
          .from('sites')
          .select('user_id')
          .eq('id', siteId)
          .retry(false)
          .abortSignal(deadline.signal)
          .maybeSingle()
        if (siteError) return null
        deadline.assertActive()
        if (site?.user_id === userId) role = 'owner'
      }

      if (!isScreenBlocked(role, blockedScreens, navKey)) return null

      const destination = firstAllowedNavHref(role, blockedScreens)
      if (destination === pathname || pathname + request.nextUrl.search === destination) {
        return NextResponse.redirect(new URL('/profile', request.url))
      }

      return NextResponse.redirect(new URL(destination, request.url))
    })
  } catch {
    // Navigation only: API routes still authenticate and authorize independently.
    return null
  } finally {
    deadline.dispose()
  }
}
