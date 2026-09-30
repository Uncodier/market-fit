import {
  eventFields, leadAttributes, pageContext, visitorScope,
  type LeadAttributes, type VisitorScope, type VisitorSession,
} from './contracts';
import {
  invalidResponse, sanitizedFailure, VisitorTrackingError, visitorRequest,
  type TrackingFailure, type TrackingResult,
} from './http';
import { VisitorSessionStore } from './session';

export type TrackingSnapshot = { visitorId: string; sessionId: string; error: TrackingFailure | null };
export const EMPTY_TRACKING_SNAPSHOT: TrackingSnapshot = { visitorId: '', sessionId: '', error: null };

export class VisitorTracker {
  private readonly listeners = new Set<() => void>();
  private readonly pages = new Map<string, Promise<TrackingResult>>();
  private store: VisitorSessionStore | undefined;
  private scope: VisitorScope | undefined;
  private configurationError: unknown;
  private snapshot = EMPTY_TRACKING_SNAPSHOT;

  constructor(siteId: string | null | undefined, apiUrl: string) {
    try {
      if (!siteId) throw new VisitorTrackingError({
        code: 'disabled', message: 'Visitor tracking has no site.', outcome: 'not_sent',
      });
      this.scope = visitorScope(siteId, apiUrl);
      this.store = new VisitorSessionStore(this.scope, session => this.update({
        ...this.snapshot, visitorId: session?.visitorId || '', sessionId: session?.sessionId || '',
      }));
    } catch (error) { this.configurationError = error; }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snapshot;

  private update(snapshot: TrackingSnapshot) {
    if (this.snapshot.visitorId === snapshot.visitorId && this.snapshot.sessionId === snapshot.sessionId
      && this.snapshot.error === snapshot.error) return;
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }

  private async run(operation: () => Promise<void>): Promise<TrackingResult> {
    try {
      if (this.configurationError) throw this.configurationError;
      await operation();
      this.update({ ...this.snapshot, error: null });
      return { ok: true };
    } catch (error) {
      const failure = sanitizedFailure(error);
      if (this.snapshot.error !== failure) {
        this.update({ ...this.snapshot, error: failure });
        // Consumers intentionally fire-and-forget analytics. Report only fixed, sanitized fields.
        if (failure.code !== 'disabled') console.warn('[SiteTracking]', failure);
      }
      return { ok: false, error: failure };
    }
  }

  initialize = () => this.run(async () => { await this.store!.ensure(); });

  private async write(path: string, session: VisitorSession, body: Record<string, unknown>) {
    try {
      return await visitorRequest(`${this.scope!.apiOrigin}${path}`, 'POST', body, session.token);
    } catch (error) {
      if (error instanceof VisitorTrackingError && [401, 403, 404].includes(error.failure.status || 0)) {
        this.store!.invalidate(session);
      }
      // No automatic replay, even for auth errors: the next user action can establish a new session.
      throw error;
    }
  }

  trackEvent = (eventType: string, payload?: Record<string, unknown>): Promise<TrackingResult> => this.run(async () => {
    const fields = eventFields(eventType, payload);
    const context = pageContext();
    const timestamp = Date.now();
    const session = await this.store!.ensure();
    const response = await this.write('/api/visitors/track', session, {
      ...fields, ...context, timestamp,
      site_id: session.siteId, session_id: session.sessionId, visitor_id: session.visitorId,
    });
    if (response.queued !== true || typeof response.event_id !== 'string'
      || response.session_id !== session.sessionId || response.visitor_id !== session.visitorId) {
      throw invalidResponse();
    }
  });

  trackPageview = (): Promise<TrackingResult> => {
    const url = window.location.href;
    const existing = this.pages.get(url);
    if (existing) return existing;
    const result = this.trackEvent('pageview');
    this.pages.set(url, result);
    void result.finally(() => { if (this.pages.get(url) === result) this.pages.delete(url); });
    return result;
  };

  identifyLead = (input: LeadAttributes): Promise<TrackingResult> => this.run(async () => {
    const attributes = leadAttributes(input);
    const session = await this.store!.ensure();
    const response = await this.write(`/api/visitors/session/${session.sessionId}/identify`, session, {
      ...attributes, site_id: session.siteId, session_id: session.sessionId, visitor_id: session.visitorId,
    });
    const data = response.data as Record<string, unknown> | undefined;
    if (data?.identity_status !== 'unverified') throw invalidResponse();
  });
}

// One coordinator per site/API in this document; storage itself is also browser-origin/tab scoped.
const trackers = new Map<string, VisitorTracker>();
export function getVisitorTracker(siteId: string | null | undefined, apiUrl: string) {
  let key = JSON.stringify([siteId || '', apiUrl]);
  try { key = visitorScope(siteId || '', apiUrl).key; } catch { /* Cache configuration failures separately. */ }
  let tracker = trackers.get(key);
  if (!tracker) {
    tracker = new VisitorTracker(siteId, apiUrl);
    trackers.set(key, tracker);
  }
  return tracker;
}