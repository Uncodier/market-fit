'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  EMPTY_TRACKING_SNAPSHOT, getVisitorTracker, type VisitorTracker,
} from './visitor-tracking/client';
import type { TrackingResult } from './visitor-tracking/http';

export function useSiteTracking(siteId?: string | null) {
  const apiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || '';
  const tracker = useMemo(() => getVisitorTracker(siteId, apiUrl), [siteId, apiUrl]);
  const snapshot = useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, () => EMPTY_TRACKING_SNAPSHOT);
  const page = useRef<{ tracker: VisitorTracker; url: string; result: Promise<TrackingResult> } | null>(null);

  useEffect(() => { void tracker.initialize(); }, [tracker]);

  const trackPageview = useCallback(() => {
    const url = window.location.href;
    // StrictMode effect replay must reuse the original result, including an ambiguous failure.
    // A changed URL/site or a real remount represents a new pageview.
    if (page.current?.tracker === tracker && page.current.url === url) return page.current.result;
    const result = tracker.trackPageview();
    page.current = { tracker, url, result };
    return result;
  }, [tracker]);

  return {
    trackPageview,
    trackEvent: tracker.trackEvent,
    identifyLead: tracker.identifyLead,
    visitorId: snapshot.visitorId,
    sessionId: snapshot.sessionId,
    error: snapshot.error,
  };
}