import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'

/** The fixed www commerce proxy preserves the browser Origin on app requests. */
export function isProcurementRequestOrigin(request: Request): boolean {
  if (isSameOriginApiRequest(request)) return true
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  return new URL(request.url).origin === 'https://app.makinari.com' &&
    (origin === 'https://www.makinari.com' || origin === 'https://makinari.com')
}