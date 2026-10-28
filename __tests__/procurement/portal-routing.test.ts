import { shouldUseLayout, shouldUseWorkspaceProviders, routeProvidesOwnMainLandmark } from '@/app/config/routes'
import { getWorkspaceSiteRedirect } from '@/lib/auth/workspace-site-redirect'
import { isAlwaysAllowedPath } from '@/lib/auth/screen-access'
import { resolvePostAuthRedirect, isShopAuthContext } from '@/lib/auth/post-auth-redirect'

describe('procurement portal routing', () => {
  test.each(['/home', '/home/profile', '/home/tenders/123', '/tenders', '/tenders/acme/office'])('keeps %s outside workspace onboarding', pathname => {
    expect(shouldUseLayout(pathname)).toBe(false)
    expect(getWorkspaceSiteRedirect({ pathname, isDemoMode: false, hasValidSession: true,
      realSiteCount: 0, hasRealCurrentSite: false })).toBeNull()
    expect(isAlwaysAllowedPath(pathname)).toBe(true)
    expect(resolvePostAuthRedirect(pathname)).toBe(pathname)
    expect(isShopAuthContext(pathname)).toBe(true)
  })
  test('preserves internal sourcing workspace boundaries', () => {
    for (const pathname of ['/suppliers', '/purchases/requests', '/purchases/tenders']) {
      expect(shouldUseLayout(pathname)).toBe(true)
      expect(isAlwaysAllowedPath(pathname)).toBe(false)
    }
    expect(shouldUseWorkspaceProviders('/home/profile')).toBe(true)
    expect(routeProvidesOwnMainLandmark('/home/profile')).toBe(true)
    expect(shouldUseWorkspaceProviders('/tenders')).toBe(false)
  })
  test('does not exempt lookalike paths from workspace selection', () => {
    expect(getWorkspaceSiteRedirect({ pathname: '/home-internal', isDemoMode: false,
      hasValidSession: true, realSiteCount: 0, hasRealCurrentSite: false })).toBe('/projects')
    expect(isAlwaysAllowedPath('/tenders-internal')).toBe(false)
  })
})