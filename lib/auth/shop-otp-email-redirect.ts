type ShopOtpLocation = {
  pathname: string
  search: string
  hostname?: string
  origin?: string
}

function currentLocation(): ShopOtpLocation {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', hostname: '', origin: '' }
  }
  return window.location
}

function allowlistedAuthOrigin(location: ShopOtpLocation): string {
  const hostname = location.hostname || ''
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return (location.origin || 'http://localhost:3000').replace(/\/$/, '')
  }
  // Shop is served on makinari.com; NEXT_PUBLIC_APP_URL may also be www.
  // GoTrue only keeps redirects on the Auth Site URL (app.makinari.com).
  return 'https://app.makinari.com'
}

/**
 * GoTrue drops emailRedirectTo when the origin is not in Redirect URLs.
 * Always use the app origin in production so auth_channel=otp reaches the hook.
 */
export function shopOtpEmailRedirectTo(location: ShopOtpLocation = currentLocation()): string {
  const origin = allowlistedAuthOrigin(location)
  const returnTo = `${location.pathname}${location.search || ''}`
  return `${origin}/auth/confirm?auth_channel=otp&returnTo=${encodeURIComponent(returnTo)}`
}
