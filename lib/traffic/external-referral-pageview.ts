import { isMakinariInternalReferrerHostname } from "@/lib/traffic/makinari-internal-referrer";

/**
 * True when a pageview should count toward "referral" traffic: non-empty referrer
 * that is not same-site, localhost, or Makinari internal navigation.
 */
export function isExternalReferralPageview(
  referrer: string | null | undefined,
  domainsToFilter: Set<string>
): boolean {
  const raw = referrer;
  if (!raw || String(raw).trim() === "") return false;
  try {
    const url = new URL(raw);
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    if (
      domainsToFilter.has(host) ||
      domainsToFilter.has(`www.${host}`) ||
      isMakinariInternalReferrerHostname(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
