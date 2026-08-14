import {
  FALLBACK_ALLOWED_PATH,
  firstAllowedNavHref,
  getNavKeyForPath,
  isAdminScreenRole,
  canManageTeamMembers,
  isAlwaysAllowedPath,
  isScreenBlocked,
  sanitizeBlockedScreens,
} from '@/lib/auth/screen-access'
import {
  CURRENT_SITE_COOKIE,
  isPersistedSiteId,
  readCurrentSiteIdFromCookieHeader,
} from '@/lib/auth/current-site-cookie'

describe('screen-access', () => {
  it('treats owner and admin as unrestricted', () => {
    expect(isAdminScreenRole('owner')).toBe(true)
    expect(isAdminScreenRole('admin')).toBe(true)
    expect(isAdminScreenRole('collaborator')).toBe(false)
    expect(isScreenBlocked('admin', ['leads'], 'leads')).toBe(false)
    expect(isScreenBlocked('collaborator', ['leads'], 'leads')).toBe(true)
    expect(canManageTeamMembers(false, 'admin')).toBe(true)
    expect(canManageTeamMembers(true, 'collaborator')).toBe(true)
    expect(canManageTeamMembers(false, 'collaborator')).toBe(false)
  })

  it('maps catalog paths to navigation keys', () => {
    expect(getNavKeyForPath('/leads', new URLSearchParams())).toBe('leads')
    expect(getNavKeyForPath('/pos/check-in', new URLSearchParams())).toBe('checkIn')
    expect(getNavKeyForPath('/settings', new URLSearchParams('tab=team'))).toBe('team')
    expect(getNavKeyForPath('/dashboard', new URLSearchParams('tab=sales'))).toBe('reportSales')
    expect(getNavKeyForPath('/robots', new URLSearchParams('mode=imprenta'))).toBe('contentCreator')
    expect(getNavKeyForPath('/profile', new URLSearchParams())).toBeNull()
  })

  it('keeps launcher and profile always allowed', () => {
    expect(isAlwaysAllowedPath('/navigation')).toBe(true)
    expect(isAlwaysAllowedPath('/profile')).toBe(true)
    expect(isAlwaysAllowedPath('/leads')).toBe(false)
  })

  it('drops unknown keys and finds the first allowed href', () => {
    expect(sanitizeBlockedScreens(['leads', 'not-a-screen', 3])).toEqual(['leads'])
    expect(firstAllowedNavHref('collaborator', [])).not.toBe(FALLBACK_ALLOWED_PATH)
    const allKeys = sanitizeBlockedScreens(
      Array.from({ length: 200 }, (_, i) => `missing-${i}`).concat(['leads'])
    )
    expect(allKeys).toEqual(['leads'])
  })
})

describe('current-site-cookie', () => {
  it('reads a valid site id from the cookie header', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(
      readCurrentSiteIdFromCookieHeader(`other=1; ${CURRENT_SITE_COOKIE}=${id}`)
    ).toBe(id)
    expect(isPersistedSiteId('demo-abc')).toBe(true)
    expect(readCurrentSiteIdFromCookieHeader(`${CURRENT_SITE_COOKIE}=not-a-uuid`)).toBeNull()
  })
})
