import { VisitorTracker } from '@/app/hooks/visitor-tracking/client';
import { VISITOR_REQUEST_TIMEOUT_MS } from '@/app/hooks/visitor-tracking/http';
import {
  API, SITE, OTHER_SITE, fetchMock, sessionFixture, sessionResponse,
  response, accepted, requestBody, resetTrackingTest,
} from './fixtures';

beforeEach(() => {
  resetTrackingTest();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it.each([401, 403, 400, 404, 429, 500, 503])('reports HTTP %s without replay, login, or unsafe response details', async status => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201))
    .mockResolvedValueOnce(response({ error: { message: 'SECRET shopper@example.com' } }, status, { 'Retry-After': '12' }));
  const tracker = new VisitorTracker(SITE, API);
  const result = await tracker.trackEvent('buy_now');
  expect(result).toMatchObject({ ok: false, error: {
    status, outcome: status < 500 ? 'rejected' : 'unknown',
  } });
  if (status === 429) expect(result).toMatchObject({ error: { code: 'rate_limited', retryAfterMs: 12_000 } });
  expect(tracker.getSnapshot().error).not.toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.stringify([result, (console.warn as jest.Mock).mock.calls])).not.toMatch(/SECRET|shopper@example|session_token/);
});

it('invalidates rejected proof but only a subsequent action gets a new session', async () => {
  const second = sessionFixture({ sessionId: OTHER_SITE });
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValueOnce(response({}, 403))
    .mockResolvedValueOnce(response(sessionResponse(second), 201)).mockResolvedValueOnce(accepted(second));
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.trackEvent('add_to_cart')).toMatchObject({ ok: false, error: { code: 'access_denied' } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(tracker.getSnapshot().sessionId).toBe('');
  expect(await tracker.trackEvent('buy_now')).toEqual({ ok: true });
  expect(requestBody(3)).toMatchObject({ event_name: 'buy_now', session_id: OTHER_SITE });
  expect(tracker.getSnapshot().error).toBeNull();
});

it('does not silently succeed or retry a failed bootstrap; later explicit actions may try again', async () => {
  fetchMock.mockRejectedValueOnce(new Error('SECRET'))
    .mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValueOnce(accepted());
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.trackEvent('buy_now')).toMatchObject({ ok: false, error: { code: 'network_error', outcome: 'unknown' } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await tracker.trackEvent('add_to_cart')).toEqual({ ok: true });
  expect(requestBody(2).event_name).toBe('add_to_cart');
});

it('bounds stalled requests and never replays a timed-out write', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockImplementationOnce(() => new Promise(() => undefined));
  const tracker = new VisitorTracker(SITE, API);
  await tracker.initialize();
  const result = tracker.trackEvent('buy_now');
  await jest.advanceTimersByTimeAsync(VISITOR_REQUEST_TIMEOUT_MS);
  expect(await result).toMatchObject({ ok: false, error: { code: 'timeout', outcome: 'unknown' } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
  await jest.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(['network', 'json', 'success-false', 'missing-ack', 'wrong-session'])(
  'treats %s after write as unconfirmed, with no automatic replay', async kind => {
    fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201));
    if (kind === 'network') fetchMock.mockRejectedValueOnce(new Error('SECRET'));
    if (kind === 'json') fetchMock.mockResolvedValueOnce({ ...accepted(), json: async () => { throw new Error('SECRET'); } });
    if (kind === 'success-false') fetchMock.mockResolvedValueOnce(response({ success: false, error: 'SECRET' }));
    if (kind === 'missing-ack') fetchMock.mockResolvedValueOnce(response({ success: true }));
    if (kind === 'wrong-session') fetchMock.mockResolvedValueOnce(accepted(sessionFixture({ sessionId: OTHER_SITE })));
    const result = await new VisitorTracker(SITE, API).trackEvent('buy_now');
    expect(result).toMatchObject({ ok: false, error: { outcome: 'unknown' } });
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);

it('does not accept identification errors as successful lead identity', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201))
    .mockResolvedValueOnce(response({ success: true, data: { lead_id: OTHER_SITE } }));
  expect(await new VisitorTracker(SITE, API).identifyLead({ email: 'shopper@example.com' }))
    .toMatchObject({ ok: false, error: { code: 'invalid_response', outcome: 'unknown' } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(['missing-token', 'wrong-site', 'expired', 'malformed'])('rejects %s bootstrap response', async kind => {
  const data = sessionResponse().data;
  if (kind === 'missing-token') data.session_token = '';
  if (kind === 'wrong-site') data.site_id = OTHER_SITE;
  if (kind === 'expired') data.expires_at = Date.now() - 1;
  fetchMock.mockResolvedValueOnce(response(kind === 'malformed' ? {} : { success: true, data }, 201));
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.trackEvent('buy_now')).toMatchObject({ ok: false, error: { code: 'invalid_response' } });
  expect(tracker.getSnapshot().sessionId).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each(['', 'javascript:alert(1)', 'https://user:password@example.com', 'https://api.example/path', 'http://api.example'])(
  'rejects unsafe or absent API configuration without network or login', async api => {
    expect(await new VisitorTracker(SITE, api).trackEvent('buy_now')).toMatchObject({
      ok: false, error: { code: 'configuration', outcome: 'not_sent' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it('does not perform requests without a valid site', async () => {
  expect(await new VisitorTracker(null, API).initialize()).toMatchObject({ ok: false, error: { code: 'disabled' } });
  expect(await new VisitorTracker('demo-site', API).initialize()).toMatchObject({ ok: false, error: { code: 'configuration' } });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('rejects oversized and unserializable event properties without dispatching the event', async () => {
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.trackEvent('buy_now', { value: 'a'.repeat(65_536) })).toMatchObject({
    ok: false, error: { code: 'invalid_payload', outcome: 'not_sent' },
  });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  expect(await tracker.trackEvent('buy_now', circular)).toMatchObject({
    ok: false, error: { code: 'invalid_payload', outcome: 'not_sent' },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});