/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.makinari.com/shop/example"}
 */

import { VisitorTracker } from '@/app/hooks/visitor-tracking/client'
import {
  API, SITE, SESSION, fetchMock, sessionFixture, sessionResponse,
  response, accepted, requestBody, resetTrackingTest,
} from './fixtures'

beforeEach(resetTrackingTest)
afterEach(() => jest.restoreAllMocks())

it('bootstraps www through app without login credentials and keeps proof writes on the configured API', async () => {
  window.history.replaceState(null, '', '/shop/example?token=private#secret')
  const session = sessionFixture()
  fetchMock.mockResolvedValueOnce(response(sessionResponse(session), 201))
    .mockResolvedValueOnce(accepted(session))
  await expect(new VisitorTracker(SITE, API).trackEvent('buy_now')).resolves.toEqual({ ok: true })
  expect(fetchMock.mock.calls[0][0]).toBe('https://app.makinari.com/api/commerce/visitor-session')
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    method: 'POST', credentials: 'omit', mode: 'cors', redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  })
  expect(requestBody(0)).toEqual({ site_id: SITE, url: 'https://www.makinari.com/shop/example' })
  expect(fetchMock.mock.calls[1][0]).toBe(`${API}/api/visitors/track`)
  expect(fetchMock.mock.calls[1][1].headers).toEqual({
    'Content-Type': 'application/json', 'X-Visitor-Session-Token': session.token,
  })
  expect(requestBody(1)).toMatchObject({ site_id: SITE, session_id: SESSION })
  expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/private|secret|Authorization|x-api-key/)
})

it('surfaces a bootstrap failure without replaying or sending an event', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  fetchMock.mockResolvedValueOnce(response({}, 503))
  expect(await new VisitorTracker(SITE, API).trackEvent('buy_now')).toMatchObject({
    ok: false, error: { code: 'http_error', status: 503, outcome: 'unknown' },
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})