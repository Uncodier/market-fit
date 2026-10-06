import { resolveAppApiUrl } from '@/app/commerce/app-api-url';
import {
  pageContext, sessionFromResponse, trackingUrl, validateSession, type VisitorScope, type VisitorSession,
} from './contracts';
import { invalidResponse, VisitorTrackingError, visitorRequest } from './http';

function storedSession(scope: VisitorScope): VisitorSession | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(scope.key) || 'null');
    return stored?.apiOrigin === scope.apiOrigin ? validateSession(stored.session, scope) : null;
  } catch { return null; }
}

function persist(scope: VisitorScope, session: VisitorSession | null) {
  try {
    if (session) sessionStorage.setItem(scope.key, JSON.stringify({ apiOrigin: scope.apiOrigin, session }));
    else sessionStorage.removeItem(scope.key);
  } catch { /* Restricted storage falls back to this document's in-memory session. */ }
}

export class VisitorSessionStore {
  private session: VisitorSession | null = null;
  private pending: Promise<VisitorSession> | null = null;
  private loaded = false;

  constructor(
    private readonly scope: VisitorScope,
    private readonly onChange: (session: VisitorSession | null) => void,
  ) {}

  invalidate(expected?: VisitorSession) {
    // A late failure must not discard a newer proof issued by a concurrent renewal.
    if (expected && this.session?.token !== expected.token) return;
    this.session = null;
    persist(this.scope, null);
    this.onChange(null);
  }

  ensure(): Promise<VisitorSession> {
    if (this.pending) return this.pending;
    const pending = this.establish();
    this.pending = pending;
    void pending.finally(() => {
      if (this.pending === pending) this.pending = null;
    }).catch(() => undefined);
    return pending;
  }

  private accept(session: VisitorSession) {
    this.session = session;
    persist(this.scope, session);
    this.onChange(session);
    return session;
  }

  private async establish(): Promise<VisitorSession> {
    const { scope } = this;
    const endpoint = `${scope.apiOrigin}/api/visitors/session`;
    if (!this.loaded) {
      this.loaded = true;
      const cached = storedSession(scope);
      // Never trust stored IDs alone, nor migrate the old random/global IDs.
      if (cached) {
        try {
          const query = new URLSearchParams({ site_id: scope.siteId, session_id: cached.sessionId });
          const response = await visitorRequest(`${endpoint}?${query}`, 'GET', undefined, cached.token);
          const data = response.data as Record<string, unknown> | undefined;
          if (data?.site_id !== cached.siteId || data?.session_id !== cached.sessionId
            || data?.visitor_id !== cached.visitorId) throw invalidResponse();
          this.session = cached;
        } catch (error) {
          // Reads are safe to recover. Never create a new session on an ambiguous read failure.
          this.loaded = false;
          if (!(error instanceof VisitorTrackingError)
            || ![401, 403, 404].includes(error.failure.status || 0)) throw error;
          this.loaded = true;
          this.invalidate();
        }
      } else {
        persist(scope, null);
      }
    }

    const current = this.session && validateSession(this.session, scope);
    if (current) {
      if (current.expiresAt > Date.now() + 60_000) return this.accept(current);
      // Renew only while the proof is still valid. GET does not issue a new token.
      try {
        const response = await visitorRequest(endpoint, 'PUT', {
          site_id: scope.siteId, session_id: current.sessionId,
          last_activity_at: Date.now(), current_url: trackingUrl(window.location.href),
        }, current.token);
        const renewed = sessionFromResponse(response, scope);
        if (renewed.sessionId !== current.sessionId || renewed.visitorId !== current.visitorId) {
          throw invalidResponse();
        }
        return this.accept(renewed);
      } catch (error) {
        if (error instanceof VisitorTrackingError && [401, 403, 404].includes(error.failure.status || 0)) {
          this.invalidate(current);
        }
        throw error;
      }
    }

    this.invalidate();
    // Hosted stores share a commerce origin, not the tenant's registered website.
    // The local issuer authorizes the public site and returns only a new visitor proof.
    const response = await visitorRequest(resolveAppApiUrl('/api/commerce/visitor-session'), 'POST', {
      site_id: scope.siteId, ...pageContext(),
    });
    return this.accept(sessionFromResponse(response, scope));
  }
}