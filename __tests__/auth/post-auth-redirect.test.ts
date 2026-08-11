import {
  DEFAULT_POST_AUTH_PATH,
  isSafeInternalPath,
  resolveAuthenticatedSignInRedirect,
  resolvePostAuthRedirect,
} from '@/lib/auth/post-auth-redirect'

describe('post-auth-redirect', () => {
  it('defaults to /robots', () => {
    expect(DEFAULT_POST_AUTH_PATH).toBe('/robots')
    expect(resolvePostAuthRedirect(null)).toBe('/robots')
    expect(resolvePostAuthRedirect(undefined)).toBe('/robots')
  })

  it('accepts safe internal returnTo paths', () => {
    expect(resolvePostAuthRedirect('/leads')).toBe('/leads')
    expect(resolvePostAuthRedirect('/robots?instance=1')).toBe('/robots?instance=1')
  })

  it('rejects open redirects and auth loops', () => {
    expect(isSafeInternalPath('https://evil.com')).toBe(false)
    expect(isSafeInternalPath('//evil.com')).toBe(false)
    expect(isSafeInternalPath('/auth')).toBe(false)
    expect(isSafeInternalPath('/auth/callback')).toBe(false)
    expect(resolvePostAuthRedirect('/auth')).toBe('/robots')
  })

  it('uses navigation history when returnTo is missing (client)', () => {
    const storage: Record<string, string> = {
      navigationHistory: JSON.stringify({
        items: [
          { path: '/auth', label: 'Auth', timestamp: 1 },
          { path: '/chat', label: 'Chat', timestamp: 2 },
        ],
      }),
    }
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value
        },
        removeItem: (key: string) => {
          delete storage[key]
        },
      },
    })

    expect(resolveAuthenticatedSignInRedirect(null)).toBe('/chat')
    expect(resolveAuthenticatedSignInRedirect('/leads')).toBe('/leads')

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    })
  })
})
