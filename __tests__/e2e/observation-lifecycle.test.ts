/** @jest-environment node */
import { EventEmitter } from 'node:events';
import type { Page, Request } from '@playwright/test';
import { assertReadObservation, isSpeculativeRead, startReadObservation,
  waitForObservedReads } from '../../tests/support/read-observation';

jest.mock('@playwright/test', () => ({
  expect: Object.assign((value: unknown) => ({
    toEqual: (expected: unknown) => expect(value).toEqual(expected),
  }), {
    poll: (callback: () => unknown) => ({
      toBe: async (expected: unknown) => expect(callback()).toBe(expected),
    }),
  }),
}));

const origin = 'https://app.makinari.com';
function request(path: string, headers: Record<string, string | undefined> = {}) {
  return { url: () => `${origin}${path}`, headers: () => headers,
    resourceType: () => 'fetch', method: () => 'GET', failure: () => null } as unknown as Request;
}
const page = () => new EventEmitter() as unknown as Page & EventEmitter;

describe('read observer lifecycle', () => {
  const previous = process.env.TEST_BASE_URL;
  beforeAll(() => { process.env.TEST_BASE_URL = origin; });
  afterAll(() => {
    if (previous === undefined) delete process.env.TEST_BASE_URL;
    else process.env.TEST_BASE_URL = previous;
  });

  it.each([{ 'next-router-prefetch': '1' }, { purpose: 'prefetch' }, { 'sec-purpose': 'prefetch;prerender' }])(
    'identifies only explicit speculative requests: %j', headers => {
      expect(isSpeculativeRead(request('/auth', headers))).toBe(true);
    },
  );
  it('does not classify ordinary RSC navigation as prefetch', () => {
    expect(isSpeculativeRead(request('/auth', { rsc: '1' }))).toBe(false);
  });
  it('preserves prefetch classification after a redirect drops synchronous custom headers', async () => {
    const parent = request('/product/crm', { 'next-router-prefetch': '1' });
    const redirected = { ...request('/auth'), redirectedFrom: () => parent };
    expect(isSpeculativeRead(redirected)).toBe(true);
    const p = page();
    startReadObservation(p);
    p.emit('request', parent);
    p.emit('request', redirected);
    await expect(assertReadObservation(p)).resolves.toBeUndefined();
  });
  it('does not wait for an unfinished prefetch stream to certify current-screen reads', async () => {
    const p = page();
    startReadObservation(p);
    p.emit('request', request('/auth', { 'next-router-prefetch': '1', rsc: '1' }));
    await expect(assertReadObservation(p)).resolves.toBeUndefined();
    expect(p.listenerCount('request')).toBe(0);
  });
  it('still fails API statuses on speculative requests instead of hiding errors', async () => {
    const p = page();
    startReadObservation(p);
    const r = request('/api/data', { purpose: 'prefetch' });
    p.emit('request', r);
    p.emit('response', { url: r.url, status: () => 500, headers: () => ({}), request: () => r, ok: () => false });
    await expect(assertReadObservation(p)).rejects.toThrow();
    expect(p.listenerCount('response')).toBe(0);
  });
  it('requires real reads to finish and can drain without discarding accumulated errors', async () => {
    const p = page();
    startReadObservation(p);
    const r = request('/api/data');
    p.emit('request', r);
    await expect(waitForObservedReads(p)).rejects.toThrow();
    p.emit('requestfinished', r);
    await expect(waitForObservedReads(p)).resolves.toBeUndefined();
    p.emit('pageerror', new Error('app failure'));
    await expect(assertReadObservation(p)).rejects.toThrow();
  });
  it('waits for successful body inspection and fails HTTP-200 application errors', async () => {
    const p = page();
    startReadObservation(p);
    const r = request('/api/data');
    p.emit('request', r);
    p.emit('response', { url: r.url, status: () => 200, headers: () => ({ 'content-type': 'application/json' }),
      request: () => r, ok: () => true, text: async () => '{"error":"read failed"}' });
    p.emit('requestfinished', r);
    await expect(assertReadObservation(p)).rejects.toThrow();
  });
  it('keeps body inspection in the drain gate after the HTTP request finishes', async () => {
    const p = page();
    startReadObservation(p);
    const r = request('/api/data');
    let complete!: (body: string) => void;
    const body = new Promise<string>(resolve => { complete = resolve; });
    p.emit('request', r);
    p.emit('response', { url: r.url, status: () => 200, headers: () => ({ 'content-type': 'application/json' }),
      request: () => r, ok: () => true, text: () => body });
    p.emit('requestfinished', r);
    await expect(waitForObservedReads(p)).rejects.toThrow();
    complete('{"data":[]}');
    await body;
    await Promise.resolve();
    await Promise.resolve();
    await expect(assertReadObservation(p)).resolves.toBeUndefined();
  });
});