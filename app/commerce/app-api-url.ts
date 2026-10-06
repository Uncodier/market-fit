/**
 * The official commerce hosts only proxy selected routes (e.g. /shop).
 * Their API calls must hit the app deployment directly.
 */
export function resolveAppApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined' &&
    ['www.makinari.com', 'makinari.com'].includes(window.location.hostname)) {
    return `https://app.makinari.com${normalized}`
  }
  return normalized
}
