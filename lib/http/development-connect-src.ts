/** Add only explicit loopback dependencies in development; never widen production CSP. */
export function developmentConnectSources(env: Record<string, string | undefined> = process.env): string[] {
  if (env.NODE_ENV !== 'development') return []
  const sources = new Set<string>(['ws://127.0.0.1:*', 'ws://localhost:*'])
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_API_SERVER_URL']) {
    const value = env[key]
    if (!value) continue
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
        || url.username || url.password || url.search || url.hash || url.pathname !== '/') continue
      sources.add(url.origin)
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') sources.add(url.origin.replace(/^http/, 'ws'))
    } catch { /* Invalid configuration never expands the allowlist. */ }
  }
  return [...sources]
}