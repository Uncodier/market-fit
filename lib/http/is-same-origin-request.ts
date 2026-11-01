/**
 * CSRF check, not authentication or a deployment hostname allowlist.
 * Next can build request.url with its bind hostname instead of the browser Host.
 * Browsers cannot override Host; compare its exact authority, not sibling hosts.
 * Proxies must preserve the public Host and sanitize forwarding headers (Next
 * itself can derive request.url's scheme from X-Forwarded-Proto). A proxy that
 * rewrites Host is unsupported: never recover it from Forwarded/X-Forwarded-*.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || !host || (fetchSite !== null && fetchSite !== "same-origin")) return false;

  // Reject lists, credentials, paths, whitespace, escapes and ambiguous ports
  // before URL parsing can normalize them into a seemingly valid authority.
  if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]+)?$/i.test(host)) return false;
  try {
    const { protocol } = new URL(request.url);
    if (protocol !== "http:" && protocol !== "https:") return false;
    const target = new URL(`${protocol}//${host}`);
    const defaultPort = protocol === "https:" ? "443" : "80";
    if (host.toLowerCase() !== target.host &&
        host.toLowerCase() !== `${target.hostname}:${defaultPort}`) return false;
    // Serialized origins only: missing/null, paths, credentials and lists fail.
    return origin === target.origin;
  } catch {
    return false;
  }
}