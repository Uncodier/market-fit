/** Resolve only server-configured API origins; paths are fixed by each route handler. */
export function configuredApiUrl(request: Request, path: string): URL | null {
  const configured = (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_SERVER_URL || '').trim()
  const base = /^https?:\/\//i.test(configured) ? configured
    : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(configured) ? 'http' : 'https'}://${configured}`
  try {
    if (!path.startsWith('/api/') || path.includes('\\')) return null
    const url = new URL(base)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!configured || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && process.env.NODE_ENV !== 'production')) ||
      url.origin === new URL(request.url).origin) return null
    return new URL(path, url)
  } catch {
    return null
  }
}

export function isSameOriginApiRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    const requestUrl = new URL(request.url)
    if (origin === requestUrl.origin) return true
    // Only normalize loopback development requests when Next uses the bind address.
    const browserOrigin = new URL(origin)
    return process.env.NODE_ENV !== 'production' &&
      ['0.0.0.0', 'localhost', '127.0.0.1', '[::1]'].includes(requestUrl.hostname) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(browserOrigin.hostname) &&
      browserOrigin.protocol === requestUrl.protocol &&
      browserOrigin.host === request.headers.get('host')
  } catch {
    return false
  }
}