import { commerceSignInHref, commerceSignInHrefFromWindow } from '@/lib/auth/commerce-sign-in-href'
import {
  DEFAULT_POST_AUTH_PATH,
  WWW_POST_AUTH_PATH,
  authReturnToFromSearchParams,
  defaultPostAuthPath,
  hostnameFromRequestHeaders,
  isSafeInternalPath,
  isShopAuthContext,
  isWwwCommerceHost,
  resolveAuthenticatedSignInRedirect,
  resolvePostAuthRedirect,
  resolveSetPasswordRedirect,
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

  it('never drops a shop or marketplace returnTo', () => {
    expect(resolvePostAuthRedirect('/shop/acme')).toBe('/shop/acme')
    expect(resolvePostAuthRedirect('/shop/acme/pizza?variant=1', 'app.makinari.com')).toBe(
      '/shop/acme/pizza?variant=1'
    )
    expect(resolvePostAuthRedirect('/marketplace?q=coffee', 'www.makinari.com')).toBe(
      '/marketplace?q=coffee'
    )
    expect(resolvePostAuthRedirect('/cart/checkout?source=shop&siteId=abc')).toBe(
      '/cart/checkout?source=shop&siteId=abc'
    )
  })

  it('prefers returnTo over redirect_to on confirm links', () => {
    const params = new URLSearchParams(
      'token_hash=abc&type=email&returnTo=/shop/acme&redirect_to=/buyer'
    )
    expect(authReturnToFromSearchParams(params)).toBe('/shop/acme')
    expect(resolvePostAuthRedirect(authReturnToFromSearchParams(params))).toBe('/shop/acme')
  })

  it('reads redirect_to when returnTo is absent', () => {
    const params = new URLSearchParams('redirect_to=/marketplace')
    expect(authReturnToFromSearchParams(params)).toBe('/marketplace')
  })

  it('extracts nested returnTo from a same-app confirm URL', () => {
    const params = new URLSearchParams(
      'redirect_to=' +
        encodeURIComponent('https://www.makinari.com/auth/confirm?returnTo=/shop/acme')
    )
    expect(authReturnToFromSearchParams(params)).toBe('/shop/acme')
  })

  it('prefers www host when the rewrite forwarded host is app', () => {
    const headers = new Headers({
      origin: 'https://www.makinari.com',
      'x-forwarded-host': 'app.makinari.com',
      host: 'app.makinari.com',
    })
    expect(hostnameFromRequestHeaders(headers)).toBe('www.makinari.com')
    expect(resolvePostAuthRedirect(null, hostnameFromRequestHeaders(headers))).toBe('/buyer')
  })

  it('builds Sign In href from the current commerce section', () => {
    expect(commerceSignInHref('/shop/acme', '?category=drinks')).toBe(
      `/auth?returnTo=${encodeURIComponent('/shop/acme?category=drinks')}`
    )
    expect(commerceSignInHref('/shop/acme/pizza')).toBe(
      `/auth?returnTo=${encodeURIComponent('/shop/acme/pizza')}`
    )
    expect(commerceSignInHref('/marketplace', 'q=coffee')).toBe(
      `/auth?returnTo=${encodeURIComponent('/marketplace?q=coffee')}`
    )
  })

  it('reads Sign In returnTo from the live address bar', () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/shop/acme',
        search: '?category=drinks',
      },
    })
    expect(commerceSignInHrefFromWindow()).toBe(
      `/auth?returnTo=${encodeURIComponent('/shop/acme?category=drinks')}`
    )
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('keeps invitation redirect_to when returnTo is not mixed in', () => {
    const invite = new URLSearchParams()
    invite.set('redirect_to', '/auth/team-invitation?siteId=abc&type=team_invitation')
    expect(resolveSetPasswordRedirect(invite)).toBe(
      '/auth/team-invitation?siteId=abc&type=team_invitation'
    )
    expect(
      resolveSetPasswordRedirect(
        new URLSearchParams('redirect_to=/projects')
      )
    ).toBe('/projects')
  })

  it('does not let a fallback returnTo override invitation redirect_to', () => {
    const mixed = new URLSearchParams(
      'redirect_to=/projects&returnTo=/buyer'
    )
    // Shop confirm still prefers returnTo; invitations must not send both.
    expect(authReturnToFromSearchParams(mixed)).toBe('/buyer')
    expect(
      resolveSetPasswordRedirect(new URLSearchParams('redirect_to=/projects'))
    ).toBe('/projects')
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
