import { expect, type Page, type Request, type Response } from '@playwright/test';
import { createHash } from 'node:crypto';

export type ReadIssue = {
  kind: 'http' | 'network' | 'pageerror' | 'application' | 'console';
  origin?: string; path?: string; status?: number; method?: string;
  contentType?: string; bodyLength?: number; bodyHash?: string;
  parseClassification?: 'invalid-json'; bodyRepresentation?: 'response-text-utf8';
};
type Observation = { issues: ReadIssue[]; pending: Set<Promise<void>>; inFlight: Set<import('@playwright/test').Request>; expectedActionErrors: Map<string, string>; stop: () => void };
const observations = new WeakMap<Page, Observation>();

export function safeEndpoint(value: string): { origin: string; path: string } {
  const url = new URL(value);
  const path = url.pathname
    .replace(/\/(?:q|so|i|vb)\/[^/]+/g, '/public-document/[redacted]')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]');
  return { origin: url.origin, path };
}

export function isUnexpectedHttp(status: number, url: string): boolean {
  const { pathname } = new URL(url);
  return status >= 500 || (status >= 400 && (pathname.startsWith('/api/') || pathname.startsWith('/rest/v1/')));
}

/** Speculative Next.js streams are not data reads needed by the current screen. */
export function isSpeculativeRead(request: Pick<Request, 'headers'> & Partial<Pick<Request, 'redirectedFrom'>>): boolean {
  // Playwright's synchronous headers can omit custom headers after a redirect.
  // Follow the actual request chain, never infer prefetch from the URL alone.
  let current: typeof request | null = request;
  while (current) {
    const headers = current.headers();
    if (headers['next-router-prefetch'] === '1'
      || /\bprefetch\b/i.test(headers.purpose || headers['sec-purpose'] || '')) return true;
    current = current.redirectedFrom?.() || null;
  }
  return false;
}

export function hasApplicationError(body: string, contentType: string, expectedError?: string): boolean {
  if (contentType.includes('text/x-component')) {
    if (/(?:^|\n)[\da-f]+:E\{/.test(body)) return true;
    return body.split('\n').some(line => {
      const record = line.match(/^[\da-f]+:(\{.*\})$/i)?.[1];
      if (!record) return false;
      try {
        const value = JSON.parse(record);
        return (value.success === false || Boolean(value.error)) && !(expectedError && value.error === expectedError);
      } catch { return false; }
    });
  }
  if (!contentType.includes('application/json')) return false;
  try {
    const value = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value)
      && (value.success === false || (Object.hasOwn(value, 'error') && Boolean(value.error)));
  } catch { return true; }
}

/** Fingerprint the exact decoded text, not wire bytes; never retain content/header parameters. */
export function invalidJsonDiagnostics(body: string, contentType: string): Partial<ReadIssue> {
  if (!contentType.includes('application/json') || contentType.includes('text/x-component')) return {};
  try { JSON.parse(body); return {}; } catch {
    return {
      contentType: 'application/json', bodyLength: Buffer.byteLength(body, 'utf8'),
      bodyHash: createHash('sha256').update(body, 'utf8').digest('hex'),
      parseClassification: 'invalid-json', bodyRepresentation: 'response-text-utf8',
    };
  }
}

/** Capture safe failure metadata only: never persist headers, tokens, payloads or customer data. */
export function startReadObservation(page: Page): void {
  if (observations.has(page)) return;
  const issues: ReadIssue[] = [];
  const pending = new Set<Promise<void>>();
  const inFlight = new Set<import('@playwright/test').Request>();
  const expectedActionErrors = new Map<string, string>();
  const origins = new Set([
    process.env.TEST_BASE_URL,
    process.env.TEST_COMMERCE_BASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.TEST_SUPABASE_URL,
  ].filter(Boolean).map(value => new URL(value!).origin));
  const response = (result: Response) => {
    const url = result.url();
    if (!origins.has(new URL(url).origin)) return;
    if (isUnexpectedHttp(result.status(), url)) {
      issues.push({ kind: 'http', ...safeEndpoint(url), status: result.status() });
    }
    const contentType = result.headers()['content-type'] || '';
    const isApplication = new URL(url).pathname.startsWith('/api/');
    const isAction = result.request().method() === 'POST' && contentType.includes('text/x-component');
    if (result.ok() && ((isApplication && contentType.includes('application/json')) || isAction)) {
      const check = result.text().then(body => {
        // Chromium may resolve an aborted read to empty text instead of rejecting.
        // Require the same explicit cancellation proof as unavailable-body handling;
        // an empty successful JSON response without that proof remains a failure.
        if (body === '' && result.request().failure()?.errorText.includes('ERR_ABORTED')) return;
        const expectedError = isAction ? expectedActionErrors.get(new URL(url).pathname) : undefined;
        if (hasApplicationError(body, contentType, expectedError)) {
          const diagnostics = invalidJsonDiagnostics(body, contentType);
          issues.push({ kind: 'application', ...safeEndpoint(url), ...diagnostics,
            ...(diagnostics.parseClassification ? { method: result.request().method(), status: result.status() } : {}) });
        }
      }).catch(() => {
        // Chromium cannot supply a body for a fetch explicitly cancelled by the UI.
        // Match requestfailed's cancellation policy; HTTP failures were recorded above.
        if (!result.request().failure()?.errorText.includes('ERR_ABORTED')) {
          issues.push({ kind: 'network', ...safeEndpoint(url) });
        }
      });
      pending.add(check);
      void check.finally(() => pending.delete(check));
    }
  };
  const failed = (request: import('@playwright/test').Request) => {
    const url = request.url();
    if (origins.has(new URL(url).origin) && !request.failure()?.errorText.includes('ERR_ABORTED')) {
      issues.push({ kind: 'network', ...safeEndpoint(url) });
    }
  };
  const error = () => { issues.push({ kind: 'pageerror' }); };
  const consoleError = (message: import('@playwright/test').ConsoleMessage) => {
    if (message.type() === 'error') issues.push({ kind: 'console' });
  };
  const started = (request: import('@playwright/test').Request) => {
    const url = new URL(request.url());
    if (origins.has(url.origin) && ['fetch', 'xhr'].includes(request.resourceType()) &&
        !isSpeculativeRead(request) && !url.pathname.startsWith('/realtime/') &&
        !url.pathname.includes('/assistant')) inFlight.add(request);
  };
  const finished = (request: import('@playwright/test').Request) => { inFlight.delete(request); };
  page.on('request', started);
  page.on('requestfinished', finished);
  page.on('requestfailed', finished);
  page.on('response', response);
  page.on('requestfailed', failed);
  page.on('pageerror', error);
  page.on('console', consoleError);
  observations.set(page, { issues, pending, inFlight, expectedActionErrors, stop: () => {
    page.off('request', started);
    page.off('requestfinished', finished);
    page.off('requestfailed', finished);
    page.off('response', response);
    page.off('requestfailed', failed);
    page.off('pageerror', error);
    page.off('console', consoleError);
  } });
}

/** Negative tests may declare one exact expected action error, not suppress all failures. */
export function expectActionError(page: Page, pathname: string, message: string): void {
  const observation = observations.get(page);
  if (!observation || !pathname.startsWith('/') || !message) throw new Error('Expected errors require an active observer and exact contract');
  observation.expectedActionErrors.set(pathname, message);
}

/** Drain actual data reads before document navigation can abort their response bodies. */
export async function waitForObservedReads(page: Page): Promise<void> {
  const observation = observations.get(page);
  if (!observation) throw new Error('Read observation was not started before navigation');
  await expect.poll(() => observation.inFlight.size + observation.pending.size, {
    timeout: 45_000,
    message: 'Critical reads must complete before navigation or a green result',
  }).toBe(0);
}

export async function assertReadObservation(page: Page): Promise<void> {
  const observation = observations.get(page);
  if (!observation) throw new Error('Read observation was not started before navigation');
  try {
    await waitForObservedReads(page);
    expect(observation.issues, 'Unexpected application/dependency failures; a rendered page is not a healthy read').toEqual([]);
  } finally {
    observation.stop();
    observations.delete(page);
  }
}