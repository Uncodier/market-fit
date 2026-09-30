import { StrictMode, useEffect } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSiteTracking } from '@/app/hooks/useSiteTracking';
import {
  SITE, OTHER_SITE, fetchMock, sessionFixture, sessionResponse,
  response, accepted, deferred, resetTrackingTest, requestBody,
} from './fixtures';

let testNumber = 0;
const previousApi = process.env.NEXT_PUBLIC_API_SERVER_URL;
beforeEach(() => {
  resetTrackingTest();
  // Isolate the document-wide coordinator without reloading React's module instance.
  process.env.NEXT_PUBLIC_API_SERVER_URL = `https://hook-${++testNumber}.example`;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (previousApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL;
  else process.env.NEXT_PUBLIC_API_SERVER_URL = previousApi;
});

function usePageConsumer(siteId?: string | null) {
  const tracking = useSiteTracking(siteId);
  const { trackPageview } = tracking;
  useEffect(() => { void trackPageview(); }, [trackPageview]);
  return tracking;
}

it('keeps callbacks stable across initialization and deduplicates StrictMode initial effects', async () => {
  const bootstrap = deferred<Response>();
  fetchMock.mockReturnValueOnce(bootstrap.promise).mockResolvedValue(accepted());
  const { result, rerender } = renderHook(() => usePageConsumer(SITE), {
    wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
  });
  const callbacks = [result.current.trackPageview, result.current.trackEvent, result.current.identifyLead];
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { bootstrap.resolve(response(sessionResponse(), 201)); });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  rerender();
  expect([result.current.trackPageview, result.current.trackEvent, result.current.identifyLead]).toEqual(callbacks);
  expect(result.current.sessionId).toBe(sessionFixture().sessionId);
  await act(async () => { expect(await result.current.trackPageview()).toEqual({ ok: true }); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('shares bootstrap and concurrent pageviews across multiple hook consumers', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValue(accepted());
  const { result } = renderHook(() => [usePageConsumer(SITE), usePageConsumer(SITE)]);
  await waitFor(() => expect(result.current[0].sessionId).not.toBe(''));
  expect(result.current[0].sessionId).toBe(result.current[1].sessionId);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('permits later navigation and real remount pageviews without suppressing revisits', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValue(accepted());
  const first = renderHook(() => usePageConsumer(SITE));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await act(async () => {
    window.history.replaceState(null, '', '/shop/example/product');
    await first.result.current.trackPageview();
    window.history.replaceState(null, '', '/shop/example');
    await first.result.current.trackPageview();
  });
  expect(fetchMock).toHaveBeenCalledTimes(4);
  first.unmount();
  renderHook(() => usePageConsumer(SITE));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
});

it('does not let a late old-site bootstrap contaminate the new site or replay its pageview', async () => {
  const oldBootstrap = deferred<Response>();
  const second = sessionFixture({ siteId: OTHER_SITE, sessionId: OTHER_SITE });
  fetchMock.mockReturnValueOnce(oldBootstrap.promise)
    .mockResolvedValueOnce(response(sessionResponse(second), 201)).mockResolvedValueOnce(accepted(second))
    .mockResolvedValueOnce(accepted());
  const { result, rerender } = renderHook(({ siteId }) => usePageConsumer(siteId), { initialProps: { siteId: SITE } });
  rerender({ siteId: OTHER_SITE });
  await waitFor(() => expect(result.current.sessionId).toBe(OTHER_SITE));
  await act(async () => { oldBootstrap.resolve(response(sessionResponse(), 201)); });
  expect(result.current.sessionId).toBe(OTHER_SITE);
  expect(requestBody(2).site_id).toBe(OTHER_SITE);
  expect(requestBody(3).site_id).toBe(SITE);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('exposes sanitized failure without unhandled rejection or StrictMode replay', async () => {
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockRejectedValueOnce(new Error('SECRET'));
  const { result, rerender } = renderHook(() => usePageConsumer(SITE), {
    wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
  });
  await waitFor(() => expect(result.current.error?.code).toBe('network_error'));
  rerender();
  await act(async () => { expect(await result.current.trackPageview()).toMatchObject({ ok: false }); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(result.current.error)).not.toContain('SECRET');
});

it('waits for a site instead of forcing anonymous visitors to log in', async () => {
  const { result, rerender } = renderHook(({ siteId }: { siteId: string | null }) => usePageConsumer(siteId), {
    initialProps: { siteId: null as string | null },
  });
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(response(sessionResponse(), 201)).mockResolvedValueOnce(accepted());
  rerender({ siteId: SITE });
  await waitFor(() => expect(result.current.sessionId).not.toBe(''));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});