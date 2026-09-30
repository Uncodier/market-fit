import { VisitorTracker, getVisitorTracker } from '@/app/hooks/visitor-tracking/client';
import { visitorScope } from '@/app/hooks/visitor-tracking/contracts';
import {
  API, SITE, OTHER_SITE, SESSION, VISITOR, fetchMock, sessionFixture, sessionResponse,
  response, accepted, cache, requestBody, resetTrackingTest, deferred,
} from './fixtures';

beforeEach(() => {
  resetTrackingTest();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('ignores legacy global identity and separates both site and API origin caches', async () => {
  localStorage.setItem('marketfit_visitor_id', VISITOR);
  sessionStorage.setItem('marketfit_session_id', SESSION);
  const first = sessionFixture();
  const second = sessionFixture({ siteId: OTHER_SITE });
  const third = sessionFixture({ sessionId: OTHER_SITE });
  fetchMock.mockResolvedValueOnce(response(sessionResponse(first), 201))
    .mockResolvedValueOnce(response(sessionResponse(second), 201))
    .mockResolvedValueOnce(response(sessionResponse(third), 201));
  await new VisitorTracker(SITE, API).initialize();
  await new VisitorTracker(OTHER_SITE, API).initialize();
  await new VisitorTracker(SITE, 'https://other-api.example').initialize();
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['POST', 'POST', 'POST']);
  expect(requestBody(0)).not.toHaveProperty('id');
  expect(requestBody(1).site_id).toBe(OTHER_SITE);
  expect(JSON.parse(sessionStorage.getItem(visitorScope(SITE, API).key)!).session).toEqual(first);
  expect(JSON.parse(sessionStorage.getItem(visitorScope(OTHER_SITE, API).key)!).session).toEqual(second);
  expect(JSON.parse(sessionStorage.getItem(visitorScope(SITE, 'https://other-api.example').key)!).session).toEqual(third);
});

it('shares the same document coordinator for normalized origins, never across sites', () => {
  expect(getVisitorTracker(SITE, API)).toBe(getVisitorTracker(SITE, `${API}/`));
  expect(getVisitorTracker(SITE, API)).toBe(getVisitorTracker(SITE, 'https://VISITOR-API.example:443'));
  expect(getVisitorTracker(SITE, API)).not.toBe(getVisitorTracker(OTHER_SITE, API));
});

it('validates a persisted session with the API before sending writes', async () => {
  const session = sessionFixture();
  cache(session);
  fetchMock.mockResolvedValueOnce(response(sessionResponse(session))).mockResolvedValueOnce(accepted(session));
  await expect(new VisitorTracker(SITE, API).trackEvent('buy_now')).resolves.toEqual({ ok: true });
  expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/visitors/session?site_id=${SITE}&session_id=${SESSION}`);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    method: 'GET', headers: { 'X-Visitor-Session-Token': session.token },
  });
  expect(fetchMock.mock.calls[1][1].method).toBe('POST');
});

it.each(['expired-envelope', 'expired-proof', 'wrong-visitor', 'wrong-site', 'no-proof', 'bad-proof', 'wrong-origin', 'bad-json'])(
  'discards %s cached data without using its proof or IDs', async kind => {
    const valid = sessionFixture();
    const invalid = { ...valid };
    if (kind === 'expired-envelope') invalid.expiresAt = Date.now() - 1000;
    if (kind === 'expired-proof') invalid.token = sessionFixture({ expiresAt: Date.now() - 1000 }).token;
    if (kind === 'wrong-visitor') invalid.visitorId = OTHER_SITE;
    if (kind === 'wrong-site') invalid.siteId = OTHER_SITE;
    if (kind === 'no-proof') invalid.token = '';
    if (kind === 'bad-proof') invalid.token = 'not-a-session-proof';
    const key = cache(invalid, API, SITE);
    if (kind === 'bad-json') sessionStorage.setItem(key, '{');
    if (kind === 'wrong-origin') sessionStorage.setItem(key, JSON.stringify({ apiOrigin: 'https://other.example', session: invalid }));
    fetchMock.mockResolvedValueOnce(response(sessionResponse(valid), 201));
    expect(await new VisitorTracker(SITE, API).initialize()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(requestBody(0)).toEqual({ site_id: SITE, url: window.location.href });
  },
);

it.each([401, 403, 404])('recovers an explicitly rejected cached-session read (%s) before a write', async status => {
  cache();
  fetchMock.mockResolvedValueOnce(response({}, status))
    .mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValueOnce(accepted());
  expect(await new VisitorTracker(SITE, API).trackEvent('add_to_cart')).toEqual({ ok: true });
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'POST', 'POST']);
});

it('does not create sessions after an ambiguous read; a later call retries the safe read', async () => {
  cache();
  fetchMock.mockRejectedValueOnce(new Error('private details'))
    .mockResolvedValueOnce(response(sessionResponse())).mockResolvedValueOnce(accepted());
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.trackEvent('buy_now')).toMatchObject({ ok: false });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await tracker.trackEvent('buy_now')).toEqual({ ok: true });
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'GET', 'POST']);
});

it('renews near-expiry proof once with PUT before concurrent writes', async () => {
  const old = sessionFixture({ expiresAt: Date.now() + 30_000 });
  const renewed = sessionFixture();
  cache(old);
  fetchMock.mockResolvedValueOnce(response(sessionResponse(old)))
    .mockResolvedValueOnce(response(sessionResponse(renewed)))
    .mockResolvedValue(accepted(renewed));
  const tracker = new VisitorTracker(SITE, API);
  expect(await Promise.all([tracker.trackEvent('buy_now'), tracker.trackEvent('add_to_cart')]))
    .toEqual([{ ok: true }, { ok: true }]);
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'PUT', 'POST', 'POST']);
  expect(fetchMock.mock.calls[1][1].headers['X-Visitor-Session-Token']).toBe(old.token);
  expect(fetchMock.mock.calls[2][1].headers['X-Visitor-Session-Token']).toBe(renewed.token);
  expect(requestBody(1)).toEqual({
    site_id: SITE, session_id: SESSION, last_activity_at: expect.any(Number), current_url: window.location.href,
  });
});

it('does not replay a failed renewal or dispatch the waiting event', async () => {
  const old = sessionFixture({ expiresAt: Date.now() + 30_000 });
  cache(old);
  fetchMock.mockResolvedValueOnce(response(sessionResponse(old))).mockResolvedValueOnce(response({}, 503));
  expect(await new VisitorTracker(SITE, API).trackEvent('buy_now')).toMatchObject({ ok: false });
  expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'PUT']);
});

it('falls back to memory when browser storage is unavailable', async () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValue(accepted());
  const tracker = new VisitorTracker(SITE, API);
  await tracker.trackEvent('buy_now');
  await tracker.trackEvent('buy_now');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('discards an expired in-memory proof rather than inventing a persistent identity', async () => {
  const clock = jest.spyOn(Date, 'now');
  const session = sessionFixture();
  fetchMock.mockResolvedValueOnce(response(sessionResponse(session), 201));
  const tracker = new VisitorTracker(SITE, API);
  await tracker.initialize();
  clock.mockReturnValue(session.expiresAt + 1);
  fetchMock.mockResolvedValueOnce(response(sessionResponse(sessionFixture()), 201)).mockResolvedValueOnce(accepted());
  await tracker.trackEvent('buy_now');
  expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'Content-Type': 'application/json' });
  expect(requestBody(1)).not.toHaveProperty('previous_session_id');
});

it('does not accept a cached-session response with mismatched identity', async () => {
  cache();
  fetchMock.mockResolvedValueOnce(response(sessionResponse(sessionFixture({ visitorId: OTHER_SITE }))));
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.trackEvent('buy_now')).toMatchObject({ ok: false, error: { code: 'invalid_response' } });
  expect(tracker.getSnapshot().sessionId).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('does not let a delayed old-proof rejection clear a newly renewed session', async () => {
  const clock = jest.spyOn(Date, 'now');
  const old = sessionFixture();
  fetchMock.mockResolvedValueOnce(response(sessionResponse(old), 201));
  const tracker = new VisitorTracker(SITE, API);
  await tracker.initialize();
  const delayedWrite = deferred<Response>();
  fetchMock.mockReturnValueOnce(delayedWrite.promise);
  const first = tracker.trackEvent('buy_now');
  // Let the original action obtain and dispatch the old proof.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  clock.mockReturnValue(old.expiresAt - 30_000);
  const renewed = sessionFixture();
  fetchMock.mockResolvedValueOnce(response(sessionResponse(renewed))).mockResolvedValueOnce(accepted(renewed));
  expect(await tracker.trackEvent('add_to_cart')).toEqual({ ok: true });
  delayedWrite.resolve(response({}, 403));
  expect(await first).toMatchObject({ ok: false });
  expect(tracker.getSnapshot().sessionId).toBe(old.sessionId);
  expect(JSON.parse(sessionStorage.getItem(visitorScope(SITE, API).key)!).session.token).toBe(renewed.token);
});