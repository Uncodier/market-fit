import { visitorScope, type VisitorSession } from '@/app/hooks/visitor-tracking/contracts';

export const SITE = '11111111-1111-4111-8111-111111111111';
export const OTHER_SITE = '22222222-2222-4222-8222-222222222222';
export const API = 'https://visitor-api.example';
export const SESSION = '33333333-3333-4333-8333-333333333333';
export const VISITOR = '44444444-4444-4444-8444-444444444444';
export const EVENT = '55555555-5555-4555-8555-555555555555';
export const fetchMock = global.fetch as jest.Mock;

export function sessionFixture(overrides: Partial<VisitorSession> = {}): VisitorSession {
  const session = {
    siteId: SITE, sessionId: SESSION, visitorId: VISITOR, expiresAt: Date.now() + 1_800_000,
    ...overrides,
  };
  // Only models the wire format. HMAC authorization remains exclusively API-side.
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return { ...session, token: `${payload}.${'s'.repeat(43)}`, ...overrides };
}

export function sessionResponse(session = sessionFixture()) {
  return { success: true, data: {
    site_id: session.siteId, session_id: session.sessionId, visitor_id: session.visitorId,
    session_token: session.token, expires_at: session.expiresAt, ttl: 1800,
  } };
}

export function response(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: (key: string) => headers[key] ?? null },
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

export function accepted(session = sessionFixture()) {
  return response({
    success: true, queued: true, event_id: EVENT,
    session_id: session.sessionId, visitor_id: session.visitorId,
  }, 202);
}

export function cache(session = sessionFixture(), api = API, site = session.siteId) {
  const scope = visitorScope(site, api);
  sessionStorage.setItem(scope.key, JSON.stringify({ apiOrigin: scope.apiOrigin, session }));
  return scope.key;
}

export function requestBody(index: number): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function resetTrackingTest() {
  fetchMock.mockReset();
  // An unplanned request always fails locally; no test can contact a live API.
  fetchMock.mockRejectedValue(new Error('Unexpected mocked request'));
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, '', '/shop/example');
}