import { useCallback, useEffect, useState } from 'react';

const VISITOR_ID_KEY = 'marketfit_visitor_id';
const SESSION_ID_KEY = 'marketfit_session_id';

const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getOrCreateVisitorId = () => {
  if (typeof window === 'undefined') return '';
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
};

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
};

export function useSiteTracking(siteId?: string | null) {
  const [visitorId, setVisitorId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    setVisitorId(getOrCreateVisitorId());
    setSessionId(getOrCreateSessionId());
  }, []);

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_SERVER_URL || '';
  };

  const trackEvent = useCallback(
    async (eventType: string, payload?: Record<string, any>) => {
      if (!siteId || !visitorId || typeof window === 'undefined') return;

      try {
        const apiUrl = getApiUrl();
        if (!apiUrl) return;

        const data = {
          site_id: siteId,
          visitor_id: visitorId,
          session_id: sessionId || getOrCreateSessionId(),
          event_type: eventType,
          url: window.location.href,
          referrer: document.referrer || undefined,
          timestamp: new Date().toISOString(),
          ...payload,
        };

        // Enviar a la API externa
        await fetch(`${apiUrl}/api/visitors/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }).catch(() => {
          // Silent catch for analytics
        });
      } catch (error) {
        console.error('[SiteTracking] Error tracking event:', error);
      }
    },
    [siteId, visitorId, sessionId]
  );

  const trackPageview = useCallback(async () => {
    await trackEvent('pageview');
  }, [trackEvent]);

  const identifyLead = useCallback(
    async (leadData: { email?: string; name?: string; phone?: string; [key: string]: any }) => {
      if (!siteId || !visitorId || typeof window === 'undefined') return;

      try {
        const apiUrl = getApiUrl();
        if (!apiUrl) return;

        const sessionIdCurrent = sessionId || getOrCreateSessionId();

        const data = {
          site_id: siteId,
          session_id: sessionIdCurrent,
          visitor_id: visitorId,
          lead_data: leadData,
          url: window.location.href,
        };

        // Identificamos el lead
        await fetch(`${apiUrl}/api/visitors/session/${sessionIdCurrent}/identify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }).catch(() => {
          // Silent catch
        });
      } catch (error) {
        console.error('[SiteTracking] Error identifying lead:', error);
      }
    },
    [siteId, visitorId, sessionId]
  );

  return {
    trackPageview,
    trackEvent,
    identifyLead,
    visitorId,
    sessionId,
  };
}
