/** Public reads are explicit: /api/public also contains authenticated generators. */
const anonymousReads = new Set(['/', '/api/status', '/api/public/posts'])
const credentialHeaders = new Set(['authorization', 'x-api-key', 'x-api-secret', 'cookie'])

export function apiRequestAuthPolicy(
  url: string,
  apiServerUrl: string,
  method: string,
  includeAuth: boolean | undefined,
  headers: Record<string, string>,
): { requiresSession: boolean; finder: boolean } {
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : null
  // Resolve relative URLs only against our own app or configured API, never //hosts.
  const base = appOrigin || apiServerUrl || 'http://localhost'
  let target: URL
  try {
    if (url.startsWith('//') || url.includes('\\')) throw new Error('Invalid path')
    target = new URL(url, base)
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) {
      throw new Error('Invalid destination')
    }
  } catch {
    throw new Error('Invalid API request destination.')
  }
  const trustedOrigins = new Set([new URL(base).origin])
  if (apiServerUrl) trustedOrigins.add(new URL(apiServerUrl).origin)
  const trusted = trustedOrigins.has(target.origin)
  const hasCredentials = Object.keys(headers).some(name => credentialHeaders.has(name.toLowerCase()))
  const local = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(target.hostname)
  if (target.protocol !== 'https:' && (!local || process.env.NODE_ENV === 'production') &&
    (includeAuth !== false || hasCredentials || trusted)) {
    throw new Error('Refusing to send credentials over an insecure API connection.')
  }
  if (!trusted) {
    if (includeAuth !== false || hasCredentials) {
      throw new Error('Refusing to send credentials to an untrusted API destination.')
    }
    return { requiresSession: false, finder: false }
  }
  const publicRead = method === 'GET' && anonymousReads.has(target.pathname)
  return {
    requiresSession: !publicRead || includeAuth !== false,
    finder: target.pathname.startsWith('/api/finder/'),
  }
}