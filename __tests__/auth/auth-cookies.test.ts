import {
  isInvalidRefreshTokenError,
  isSupabaseAuthCookieName,
} from '@/lib/supabase/auth-cookies'

describe('auth-cookies', () => {
  it('identifies project and chunked supabase cookies', () => {
    expect(isSupabaseAuthCookieName('sb-db-auth-token')).toBe(true)
    expect(isSupabaseAuthCookieName('sb-db-auth-token.0')).toBe(true)
    expect(isSupabaseAuthCookieName('sb-rnjgeloamtszdjplmqxy-auth-token.1')).toBe(true)
    expect(isSupabaseAuthCookieName('market_fit_demo_site_id')).toBe(false)
  })

  it('detects missing or reused refresh tokens', () => {
    expect(
      isInvalidRefreshTokenError({
        code: 'refresh_token_not_found',
        message: 'Invalid Refresh Token: Refresh Token Not Found',
      })
    ).toBe(true)
    expect(
      isInvalidRefreshTokenError({
        message: 'Invalid Refresh Token: Refresh Token Already Used',
      })
    ).toBe(true)
    expect(isInvalidRefreshTokenError({ code: 'invalid_grant' })).toBe(false)
    expect(isInvalidRefreshTokenError(null)).toBe(false)
  })
})
