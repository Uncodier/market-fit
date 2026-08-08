/**
 * www only proxies selected page routes (e.g. /shop). API calls from www must
 * hit the app deployment directly.
 */
export function resolveAppApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined' && window.location.hostname === 'www.makinari.com') {
    return `https://app.makinari.com${normalized}`
  }
  return normalized
}
