import { z } from 'zod';
import { invalidResponse, serializeVisitorBody, VisitorTrackingError } from './http';

export type VisitorScope = { siteId: string; apiOrigin: string; key: string };
export type VisitorSession = {
  siteId: string; visitorId: string; sessionId: string; token: string; expiresAt: number;
};

export function visitorScope(siteId: string, apiUrl: string): VisitorScope {
  try {
    const url = new URL(apiUrl);
    if (!z.string().uuid().safeParse(siteId).success || url.username || url.password
      || url.search || url.hash || url.pathname !== '/'
      || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error();
    return {
      siteId, apiOrigin: url.origin,
      key: `marketfit:visitor-session:v1:${encodeURIComponent(url.origin)}:${siteId}`,
    };
  } catch {
    throw new VisitorTrackingError({
      code: 'configuration', message: 'Visitor tracking configuration is unavailable.', outcome: 'not_sent',
    });
  }
}

const sessionSchema = z.object({
  siteId: z.string().uuid(), visitorId: z.string().uuid(), sessionId: z.string().uuid(),
  token: z.string().min(1).max(2048), expiresAt: z.number().finite(),
});

// This only checks cache consistency/expiry. The API alone verifies the HMAC proof.
export function validateSession(value: unknown, scope: VisitorScope): VisitorSession | null {
  try {
    const session = sessionSchema.parse(value);
    const [payload, signature, ...extra] = session.token.split('.');
    if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)
      || !/^[A-Za-z0-9_-]{43}$/.test(signature || '') || extra.length) return null;
    const encoded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    if (session.siteId !== scope.siteId || claims.siteId !== session.siteId
      || claims.sessionId !== session.sessionId || claims.visitorId !== session.visitorId
      || typeof claims.expiresAt !== 'number' || !Number.isFinite(claims.expiresAt)) return null;
    const expiresAt = Math.min(session.expiresAt, claims.expiresAt);
    return expiresAt > Date.now() + 5_000 ? { ...session, expiresAt } : null;
  } catch { return null; }
}

export function sessionFromResponse(response: Record<string, unknown>, scope: VisitorScope): VisitorSession {
  const data = response.data as Record<string, unknown> | undefined;
  const session = validateSession(data && {
    siteId: data.site_id, visitorId: data.visitor_id, sessionId: data.session_id,
    token: data.session_token, expiresAt: data.expires_at,
  }, scope);
  if (!session) throw invalidResponse();
  return session;
}

const nativeEvents = new Set([
  'pageview', 'click', 'custom', 'purchase', 'action', 'mousemove', 'scroll', 'keypress',
  'resize', 'focus', 'form_submit', 'form_change', 'form_error', 'performance', 'error',
]);
const reservedFields = new Set([
  'site_id', 'session_id', 'visitor_id', 'id', 'lead_id', 'segment_id', 'session_token',
  'token', 'event_id', 'event_type', 'event_name', 'timestamp', 'url', 'referrer',
  'user_agent', 'ip', 'properties', '__proto__', 'constructor', 'prototype',
]);

export function eventFields(eventType: string, payload: Record<string, unknown> = {}) {
  z.string().trim().min(1).max(250).parse(eventType);
  z.record(z.unknown()).parse(payload);
  const properties = {
    ...Object.fromEntries(Object.entries(payload).filter(([key]) => !reservedFields.has(key))),
    ...(payload.properties === undefined ? {} : z.record(z.unknown()).parse(payload.properties)),
  };
  const event_type = nativeEvents.has(eventType) ? eventType : 'custom';
  const event_name = event_type === 'custom' || event_type === 'action'
    ? z.string().trim().min(1).max(250).parse(nativeEvents.has(eventType) ? payload.event_name : eventType)
    : undefined;
  // Snapshot before waiting for bootstrap; later caller mutations cannot change the write.
  return JSON.parse(serializeVisitorBody({ event_type, event_name, properties })!) as Record<string, unknown>;
}

export type LeadAttributes = { email?: string; name?: string; phone?: string; [key: string]: unknown };
const attributesSchema = z.object({
  email: z.string().email().max(320).optional(), name: z.string().max(250).optional(),
  phone: z.string().max(100).optional(),
}).refine(value => Object.values(value).some(Boolean));

export function leadAttributes(input: LeadAttributes) {
  return attributesSchema.parse(Object.fromEntries(['email', 'name', 'phone'].map(key => {
    const value = input[key];
    return [key, typeof value === 'string' ? value.trim() || undefined : value];
  })));
}

export function trackingUrl(value: string) {
  const url = new URL(value);
  // Checkout queries/fragments may contain contact details or bearer credentials.
  const path = url.pathname.replace(/^\/(q|so|i|vb)\/[^/]+/, '/$1/[redacted]');
  return `${url.origin}${path}`;
}

export function pageContext() {
  return {
    url: trackingUrl(window.location.href),
    ...(document.referrer ? { referrer: trackingUrl(document.referrer) } : {}),
  };
}