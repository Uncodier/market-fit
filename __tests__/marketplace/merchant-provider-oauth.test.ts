/** @jest-environment node */
import { createHash } from 'node:crypto';
import { buildAuthorizationUrl, exchangeAuthorization } from '../../lib/marketplace/merchant/providers';
import { app, json, merchantJwt, synthetic, verifier } from './merchant-provider-fixtures';

describe('offline merchant OAuth official contracts', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; });

  test.each(['production', 'sandbox'] as const)('Rappi %s uses fixed Partners origin and S256 PKCE, never app secret', environment => {
    const config = app('rappi', environment);
    const state = synthetic();
    const codeVerifier = verifier();
    const url = new URL(buildAuthorizationUrl(config, state, codeVerifier));
    expect(url.origin).toBe(environment === 'sandbox' ? 'https://login.partners.dev.rappi.com' : 'https://login.partners.rappi.com');
    expect(url.pathname).toBe('/authorize');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(codeVerifier).digest('base64url'));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirect_uri);
    expect(url.searchParams.get('response_type')).toBe('code');
    for (const sensitive of [config.client_secret, codeVerifier]) expect(url.toString()).not.toContain(sensitive);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('Rappi public PKCE exchange uses id_token not opaque access_token and JWT exp not access-token lifetime', async () => {
    const config = app('rappi');
    const code = synthetic();
    const codeVerifier = verifier();
    const expiry = Math.floor(Date.now() / 1000) + 1234;
    const token = merchantJwt(expiry);
    const opaque = Array.from({ length: 5 }, synthetic).join('.');
    fetchMock.mockImplementation(async (url, init) => {
      expect(String(url)).toBe('https://login.partners.dev.rappi.com/oauth/token');
      expect(init).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store' });
      expect(init?.signal).toBeDefined();
      const form = new URLSearchParams(String(init?.body));
      expect(Object.fromEntries(form)).toEqual({ grant_type: 'authorization_code', code, client_id: config.client_id,
        redirect_uri: config.redirect_uri, code_verifier: codeVerifier });
      expect(String(init?.body)).not.toContain(config.client_secret);
      return json({ access_token: opaque, id_token: token, expires_in: 999999, token_type: 'Bearer' });
    });
    expect(await exchangeAuthorization(config, code, codeVerifier)).toEqual({ merchant_token: token,
      expires_at: new Date(expiry * 1000).toISOString() });
  });

  test('Rappi opaque access token, missing id_token, expired or invalid claims fail closed', async () => {
    const config = app('rappi');
    for (const payload of [{ access_token: synthetic() }, { id_token: Array.from({ length: 5 }, synthetic).join('.') },
      { id_token: merchantJwt(Math.floor(Date.now() / 1000) - 1) }, { id_token: `${synthetic()}.${synthetic()}.${synthetic()}` }]) {
      fetchMock.mockResolvedValueOnce(json(payload));
      await expect(exchangeAuthorization(config, synthetic(), verifier())).rejects.toThrow();
    }
  });

  test.each(['production', 'sandbox'] as const)('Uber %s confidential merchant flow uses only pos provisioning scope', async environment => {
    const config = app('uber_eats', environment);
    const codeVerifier = verifier();
    const state = synthetic();
    const url = new URL(buildAuthorizationUrl(config, state, codeVerifier));
    const origin = environment === 'sandbox' ? 'https://sandbox-login.uber.com' : 'https://auth.uber.com';
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe('/oauth/v2/authorize');
    expect(url.searchParams.get('scope')).toBe('eats.pos_provisioning');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.toString()).not.toContain(config.client_secret);
    const token = synthetic();
    const refresh = synthetic();
    const code = synthetic();
    fetchMock.mockImplementation(async (target, init) => {
      expect(String(target)).toBe(`${origin}/oauth/v2/token`);
      const form = new URLSearchParams(String(init?.body));
      expect(Object.fromEntries(form)).toEqual({ grant_type: 'authorization_code', code, client_id: config.client_id,
        redirect_uri: config.redirect_uri, client_secret: config.client_secret });
      return json({ access_token: token, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600 });
    });
    const result = await exchangeAuthorization(config, code, codeVerifier);
    expect(result).toMatchObject({ merchant_token: token, refresh_token: refresh });
    expect(Date.parse(result.expires_at!) - Date.now()).toBeGreaterThan(3599000);
  });

  test('rejects malformed app redirect/webhook/settings, state, verifier and header tokens without network', async () => {
    const config = app();
    const authenticated = new URL('https://merchant.example.test/cb');
    authenticated.username = synthetic();
    authenticated.password = synthetic();
    for (const change of [{ redirect_uri: authenticated.toString() },
      { redirect_uri: 'http://merchant.example.test/cb' }, { webhook_url: 'https://merchant.example.test:8443/hooks' },
      { country: '../MX' }, { environment: 'other' }, { client_id: '' }]) {
      expect(() => buildAuthorizationUrl({ ...config, ...change } as typeof config, synthetic(), verifier())).toThrow();
    }
    expect(() => buildAuthorizationUrl(config, 'short-state', verifier())).toThrow();
    expect(() => buildAuthorizationUrl(config, synthetic(), 'short-verifier')).toThrow();
    await expect(exchangeAuthorization(config, `${synthetic()}\r\n`, verifier())).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('provider errors are sanitized, omit app secret, authorization code, verifier, tokens and body', async () => {
    const config = app();
    const code = synthetic();
    const codeVerifier = verifier();
    const token = synthetic();
    fetchMock.mockResolvedValue(json({ client_secret: config.client_secret, code, codeVerifier, token }, 401));
    const error: unknown = await exchangeAuthorization(config, code, codeVerifier).catch(value => value);
    expect(error).toMatchObject({ code: 'http_error', http_status: 401 });
    for (const sensitive of [config.client_secret, code, codeVerifier, token]) expect(String(error)).not.toContain(sensitive);
  });
});