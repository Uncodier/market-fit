export type TrackingFailure = {
  code: 'disabled' | 'configuration' | 'invalid_payload' | 'invalid_response'
    | 'access_denied' | 'rate_limited' | 'http_error' | 'network_error' | 'timeout';
  message: string;
  outcome: 'not_sent' | 'rejected' | 'unknown';
  status?: number;
  retryAfterMs?: number;
};

export type TrackingResult = { ok: true } | { ok: false; error: TrackingFailure };

export class VisitorTrackingError extends Error {
  constructor(readonly failure: TrackingFailure) {
    super(failure.message);
  }
}

export function invalidResponse(): VisitorTrackingError {
  return new VisitorTrackingError({
    code: 'invalid_response', message: 'Visitor tracking response was not confirmed.', outcome: 'unknown',
  });
}

export function sanitizedFailure(error: unknown): TrackingFailure {
  return error instanceof VisitorTrackingError ? error.failure : {
    code: 'invalid_payload', message: 'Visitor tracking input is invalid.', outcome: 'not_sent',
  };
}

function responseError(response: Response): VisitorTrackingError {
  const status = response.status;
  const denied = status === 401 || status === 403;
  const retryAfter = response.headers.get('Retry-After');
  const delay = retryAfter === null ? NaN : /^\d+$/.test(retryAfter)
    ? Number(retryAfter) * 1_000 : Date.parse(retryAfter) - Date.now();
  return new VisitorTrackingError({
    code: denied ? 'access_denied' : status === 429 ? 'rate_limited' : 'http_error',
    message: denied ? 'Visitor tracking access was denied.'
      : status === 429 ? 'Visitor tracking is rate limited.' : 'Visitor tracking request failed.',
    status,
    outcome: status >= 400 && status < 500 ? 'rejected' : 'unknown',
    ...(status === 429 && Number.isFinite(delay) ? { retryAfterMs: Math.max(0, delay) } : {}),
  });
}

export const VISITOR_REQUEST_TIMEOUT_MS = 10_000;
export const VISITOR_REQUEST_MAX_BYTES = 64 * 1024;

export function serializeVisitorBody(body?: Record<string, unknown>): string | undefined {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  if (serialized && new Blob([serialized]).size > VISITOR_REQUEST_MAX_BYTES) {
    throw new VisitorTrackingError({
      code: 'invalid_payload', message: 'Visitor tracking input is too large.', outcome: 'not_sent',
    });
  }
  return serialized;
}

// Deliberately independent of the workspace API client and all login/service credentials.
export async function visitorRequest(
  url: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: Record<string, unknown>,
  token?: string,
): Promise<Record<string, unknown>> {
  const serialized = serializeVisitorBody(body);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new VisitorTrackingError({
        code: 'timeout', message: 'Visitor tracking confirmation timed out.', outcome: 'unknown',
      }));
      controller.abort();
    }, VISITOR_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(url, {
        method, credentials: 'omit', mode: 'cors', redirect: 'error', cache: 'no-store',
        headers: {
          ...(serialized === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { 'X-Visitor-Session-Token': token } : {}),
        },
        body: serialized,
        signal: controller.signal,
      });
      if (!response.ok) throw responseError(response);
      let data: unknown;
      try { data = await response.json(); } catch { throw invalidResponse(); }
      if (!data || typeof data !== 'object' || Array.isArray(data)
        || !('success' in data) || data.success !== true) throw invalidResponse();
      return data as Record<string, unknown>;
    })()]);
  } catch (error) {
    if (error instanceof VisitorTrackingError) throw error;
    throw new VisitorTrackingError({
      code: 'network_error', message: 'Visitor tracking delivery could not be confirmed.', outcome: 'unknown',
    });
  } finally {
    clearTimeout(timer);
  }
}