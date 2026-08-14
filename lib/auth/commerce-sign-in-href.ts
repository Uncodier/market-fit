/** Sign-in URL that returns to the current commerce section (path + query). */
export function commerceSignInHref(
  pathname?: string | null,
  search?: string | null
): string {
  const path = pathname && pathname.startsWith('/') ? pathname : '/'
  const query = !search
    ? ''
    : search.startsWith('?')
      ? search
      : `?${search}`
  return `/auth?returnTo=${encodeURIComponent(`${path}${query}`)}`
}

/** Prefer the live address bar (includes history.replaceState category updates). */
export function commerceSignInHrefFromWindow(): string {
  if (typeof window === 'undefined') return commerceSignInHref('/')
  return commerceSignInHref(window.location.pathname, window.location.search)
}

export const COMMERCE_LOCATION_CHANGE_EVENT = 'makinari:locationchange'

export function notifyCommerceLocationChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(COMMERCE_LOCATION_CHANGE_EVENT))
}
