/**
 * Helpers for Supabase auth cookies and refresh-token failures.
 * Cookie names are derived from the project URL (e.g. sb-db-auth-token,
 * sb-rnjgeloamtszdjplmqxy-auth-token) and may be chunked (.0, .1).
 */

export function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith('sb-')
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const e = error as { code?: string; message?: string; error_code?: string }
  const code = `${e.code || e.error_code || ''}`.toLowerCase()
  const message = `${e.message || ''}`.toLowerCase()

  return (
    code === 'refresh_token_not_found' ||
    code === 'refresh_token_already_used' ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('refresh token already used')
  )
}

export const EXPIRED_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 0,
  expires: new Date(0),
} as const
