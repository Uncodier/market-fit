/**
 * Referrers from Makinari-owned hosts (e.g. app, docs, marketing) are internal
 * cross-navigation, not third-party acquisition sources. Session-entry reports
 * retain them as "Internal navigation" rather than dropping their denominator.
 */
export function isMakinariInternalReferrerHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const base = h.startsWith("www.") ? h.slice(4) : h;
  return base === "makinari.com" || base.endsWith(".makinari.com");
}
