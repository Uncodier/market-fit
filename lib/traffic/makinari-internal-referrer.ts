/**
 * Referrers from Makinari-owned hosts (e.g. app, docs, marketing) are internal
 * cross-navigation, not third-party acquisition sources. They are excluded from
 * referrer breakdowns; sessions with no referrer remain "Direct".
 */
export function isMakinariInternalReferrerHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const base = h.startsWith("www.") ? h.slice(4) : h;
  return base === "makinari.com" || base.endsWith(".makinari.com");
}
