import {
  DEFAULT_POST_AUTH_PATH,
  WWW_POST_AUTH_PATH,
  defaultPostAuthPath,
  isSafeInternalPath,
  isShopAuthContext,
  isWwwCommerceHost,
  resolveAuthenticatedSignInRedirect,
  resolvePostAuthRedirect,
} from '@/lib/auth/post-auth-redirect'

describe('post-auth-redirect', () => {
  it('defaults to /robots on app', () => {
    expect(DEFAULT_POST_AUTH_PATH).toBe('/robots')
    expect(resolvePostAuthRedirect(null)).toBe('/robots')
    expect(resolvePostAuthRedirect(undefined)).toBe('/robots')
    expect(resolvePostAuthRedirect(null, 'app.makinari.com')).toBe('/robots')
  })

  it('defaults to /buyer on www', () => {
    expect(WWW_POST_AUTH_PATH).toBe('/buyer')
    expect(isWwwCommerceHost('makinari.com')).toBe(true)
    expect(isWwwCommerceHost('www.makinari.com')).toBe(true)
    expect(isWwwCommerceHost('app.makinari.com')).toBe(false)
    expect(defaultPostAuthPath('makinari.com')).toBe('/buyer')
    expect(defaultPostAuthPath('www.makinari.com')).toBe('/buyer')
    expect(resolvePostAuthRedirect(null, 'www.makinari.com')).toBe('/buyer')
    expect(resolvePostAuthRedirect('/auth', 'makinari.com')).toBe('/buyer')
  })

  it('accepts safe internal returnTo paths', () => {
    expect(resolvePostAuthRedirect('/leads')).toBe('/leads')
    expect(resolvePostAuthRedirect('/robots?instance=1')).toBe('/robots?instance=1')
    expect(resolvePostAuthRedirect('/buyer', 'app.makinari.com')).toBe('/buyer')
  })

  it('rejects open redirects and auth loops', () => {
    expect(isSafeInternalPath('https://evil.com')).toBe(false)
    expect(isSafeInternalPath('//evil.com')).toBe(false)
    expect(isSafeInternalPath('/auth')).toBe(false)
    expect(isSafeInternalPath('/auth/callback')).toBe(false)
    expect(isSafeInternalPath('/')).toBe(false)
    expect(resolvePostAuthRedirect('/auth')).toBe('/robots')
    expect(resolvePostAuthRedirect('/')).toBe('/robots')
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
    expect(resolveAuthenticatedSignInRedirect(null, 'www.makinari.com')).toBe('/chat')

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    })
  })

  it('falls back to /buyer on www when history is empty', () => {
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    })

    expect(resolveAuthenticatedSignInRedirect(null, 'www.makinari.com')).toBe('/buyer')
    expect(resolveAuthenticatedSignInRedirect(null, 'app.makinari.com')).toBe('/robots')

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    })
  })

  it('treats storefront returnTo as shop auth context', () => {
    expect(isShopAuthContext('/shop/acme')).toBe(true)
    expect(isShopAuthContext('/shop/acme?tab=orders')).toBe(true)
    expect(isShopAuthContext('/marketplace')).toBe(true)
    expect(isShopAuthContext('/buyer')).toBe(true)
    expect(isShopAuthContext('/cart/checkout')).toBe(true)
  })

  it('keeps marketing and workspace entry on product copy', () => {
    expect(isShopAuthContext(null)).toBe(false)
    expect(isShopAuthContext(undefined)).toBe(false)
    expect(isShopAuthContext('/robots')).toBe(false)
    expect(isShopAuthContext('/leads')).toBe(false)
    expect(isShopAuthContext('/shopping')).toBe(false)
    expect(isShopAuthContext('/auth')).toBe(false)
  })
})
