/** Default landing for authenticated users leaving the sign-in page on app. */
export const DEFAULT_POST_AUTH_PATH = '/robots'

/** Default landing for authenticated users on www (commerce, not workspace). */
export const WWW_POST_AUTH_PATH = '/buyer'

const WWW_HOSTS = new Set(['makinari.com', 'www.makinari.com'])

const SHOP_AUTH_PATH_PREFIXES = ['/shop', '/marketplace', '/buyer', '/cart'] as const

/**
 * Accept only same-origin relative paths that are not auth flows
 * (prevents open redirects and auth loops).
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.startsWith('/auth')) return false
  // Landing page re-enters the sign-in client; never bounce there after auth.
  const pathname = path.split('?')[0].split('#')[0]
  if (pathname === '/') return false
  return true
}

export function isWwwCommerceHost(hostname?: string | null): boolean {
  if (hostname) return WWW_HOSTS.has(hostname)
  if (typeof window === 'undefined') return false
  return WWW_HOSTS.has(window.location.hostname)
}

/** Workspace on app, buyer portal on www. */
export function defaultPostAuthPath(hostname?: string | null): string {
  return isWwwCommerceHost(hostname) ? WWW_POST_AUTH_PATH : DEFAULT_POST_AUTH_PATH
}

/**
 * Shop/buyer login copy when returnTo points at a storefront, marketplace,
 * buyer portal, or cart. Marketing and workspace entry stay on product copy.
 */
export function isShopAuthContext(returnTo?: string | null): boolean {
  if (!isSafeInternalPath(returnTo)) return false
  const path = returnTo.split('?')[0].split('#')[0]
  return SHOP_AUTH_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

/** Prefer returnTo, otherwise fall back to host-aware default. */
export function resolvePostAuthRedirect(
  returnTo?: string | null,
  hostname?: string | null
): string {
  return isSafeInternalPath(returnTo) ? returnTo : defaultPostAuthPath(hostname)
}

/**
 * Client-only: returnTo → last navigation history entry → host default.
 */
export function resolveAuthenticatedSignInRedirect(
  returnTo?: string | null,
  hostname?: string | null
): string {
  if (isSafeInternalPath(returnTo)) return returnTo

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('navigationHistory')
      if (stored) {
        const history = JSON.parse(stored) as { items?: Array<{ path?: string }> }
        const items = history?.items
        if (Array.isArray(items)) {
          for (let i = items.length - 1; i >= 0; i--) {
            const path = items[i]?.path
            if (isSafeInternalPath(path)) return path
          }
        }
      }
    } catch {
      // ignore malformed history
    }
  }

  return defaultPostAuthPath(hostname)
}
