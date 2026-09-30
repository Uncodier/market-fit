import { VisitorTracker } from '@/app/hooks/visitor-tracking/client';
import {
  API, SITE, SESSION, VISITOR, fetchMock, sessionFixture, sessionResponse,
  response, accepted, requestBody, deferred, resetTrackingTest,
} from './fixtures';

beforeEach(resetTrackingTest);
afterEach(() => jest.restoreAllMocks());

it('bootstraps anonymous callers once and sends only API-issued identity/proof', async () => {
  const session = sessionFixture();
  const bootstrap = deferred<Response>();
  fetchMock.mockReturnValueOnce(bootstrap.promise).mockResolvedValueOnce(accepted(session))
    .mockResolvedValueOnce(response({ success: true, data: { identity_status: 'unverified' } }));
  const tracker = new VisitorTracker(SITE, API);
  const initialized = tracker.initialize();
  const event = tracker.trackEvent('add_to_cart', { item_id: 'product', price: 25 });
  const identify = tracker.identifyLead({ email: 'shopper@example.com' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe('/api/commerce/visitor-session');
  expect(tracker.getSnapshot().sessionId).toBe('');
  expect(requestBody(0)).toEqual({ site_id: SITE, url: window.location.href });
  bootstrap.resolve(response(sessionResponse(session), 201));
  expect(await Promise.all([initialized, event, identify])).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
  expect(tracker.getSnapshot()).toEqual({ visitorId: VISITOR, sessionId: SESSION, error: null });
  expect(requestBody(1)).toMatchObject({
    site_id: SITE, session_id: SESSION, visitor_id: VISITOR, event_type: 'custom',
    event_name: 'add_to_cart', properties: { item_id: 'product', price: 25 },
    timestamp: expect.any(Number),
  });
  for (const [index, [, init]] of fetchMock.mock.calls.entries()) {
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', mode: 'cors' });
    expect(init.headers).toEqual({
      'Content-Type': 'application/json', ...(index ? { 'X-Visitor-Session-Token': session.token } : {}),
    });
  }
  expect(fetchMock.mock.calls[1][0]).toBe(`${API}/api/visitors/track`);
  expect(fetchMock.mock.calls[2][0]).toBe(`${API}/api/visitors/session/${SESSION}/identify`);
});

it.each(['add_to_cart', 'buy_now', 'another_event'])('maps %s to custom properties without identity overrides', async event => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValueOnce(accepted());
  const tracker = new VisitorTracker(SITE, API);
  const before = Date.now();
  await expect(tracker.trackEvent(event, {
    site_id: 'forged', visitor_id: 'forged', session_id: 'forged', id: 'forged',
    lead_id: 'forged', segment_id: 'forged', timestamp: 'invalid', event_type: 'purchase',
    event_name: 'forged', event_id: 'forged', url: 'https://forged.example', session_token: 'forged',
    item_id: 'product', currency: 'USD', properties: { quantity: 2 },
  })).resolves.toEqual({ ok: true });
  expect(requestBody(1)).toEqual({
    site_id: SITE, visitor_id: VISITOR, session_id: SESSION, timestamp: expect.any(Number),
    event_type: 'custom', event_name: event, url: window.location.href,
    properties: { item_id: 'product', currency: 'USD', quantity: 2 },
  });
  expect(requestBody(1).timestamp).toBeGreaterThanOrEqual(before);
});

it('preserves supported native event names and nested properties', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201))
    .mockResolvedValue(accepted());
  const tracker = new VisitorTracker(SITE, API);
  await tracker.trackEvent('action', { event_name: 'open_cart', properties: { source: 'header' } });
  await tracker.trackEvent('click', { properties: { x: 1, y: 2 } });
  expect(requestBody(1)).toMatchObject({ event_type: 'action', event_name: 'open_cart', properties: { source: 'header' } });
  expect(requestBody(2)).toMatchObject({ event_type: 'click', properties: { x: 1, y: 2 } });
  expect(requestBody(2)).not.toHaveProperty('event_name');
});

it('snapshots event context and properties while bootstrap is pending', async () => {
  const bootstrap = deferred<Response>();
  fetchMock.mockReturnValueOnce(bootstrap.promise).mockResolvedValueOnce(accepted());
  const tracker = new VisitorTracker(SITE, API);
  const payload = { properties: { item_id: 'original' } };
  const result = tracker.trackEvent('buy_now', payload);
  payload.properties.item_id = 'changed';
  window.history.replaceState(null, '', '/cart/checkout');
  bootstrap.resolve(response(sessionResponse(), 201));
  await result;
  expect(requestBody(1)).toMatchObject({ url: 'http://localhost/shop/example', properties: { item_id: 'original' } });
});

it('identifies only top-level unverified attributes, never lead grants or legacy fields', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201))
    .mockResolvedValueOnce(response({ success: true, data: { identity_status: 'unverified' } }));
  const tracker = new VisitorTracker(SITE, API);
  expect(await tracker.identifyLead({
    email: ' shopper@example.com ', name: ' Shopper ', phone: ' +15550000000 ',
    site_id: 'forged', visitor_id: 'forged', session_id: 'forged', lead_id: 'forged', url: 'forged',
    lead_data: { name: 'forged' },
  })).toEqual({ ok: true });
  expect(fetchMock.mock.calls[1][0]).toBe(`${API}/api/visitors/session/${SESSION}/identify`);
  expect(requestBody(1)).toEqual({
    site_id: SITE, session_id: SESSION, visitor_id: VISITOR,
    email: 'shopper@example.com', name: 'Shopper', phone: '+15550000000',
  });
});

it.each([{ email: 'invalid' }, { name: 'n'.repeat(251) }, { phone: 'p'.repeat(101) }, {}])(
  'rejects invalid attributes before any request', async input => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await new VisitorTracker(SITE, API).identifyLead(input)).toMatchObject({
      ok: false, error: { code: 'invalid_payload', outcome: 'not_sent' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it('coalesces concurrent pageviews but does not deduplicate distinct shopper actions', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValue(accepted());
  const tracker = new VisitorTracker(SITE, API);
  await Promise.all([tracker.trackPageview(), tracker.trackPageview()]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await Promise.all([tracker.trackEvent('buy_now'), tracker.trackEvent('buy_now')]);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('does not send contact or bearer credentials in page URLs/referrers', async () => {
  window.history.replaceState(null, '', '/cart/checkout?email=private@example.com#secret');
  jest.spyOn(document, 'referrer', 'get').mockReturnValue('https://shop.example/q/private-token?email=private@example.com');
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValueOnce(accepted());
  expect(await new VisitorTracker(SITE, API).trackPageview()).toEqual({ ok: true });
  expect(requestBody(0)).toEqual({
    site_id: SITE, url: 'http://localhost/cart/checkout', referrer: 'https://shop.example/q/[redacted]',
  });
  expect(requestBody(1)).toMatchObject({
    url: 'http://localhost/cart/checkout', referrer: 'https://shop.example/q/[redacted]',
  });
  expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/private-token|private@example|secret/);
});