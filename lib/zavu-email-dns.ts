export const ZAVU_INBOUND_MX_HOST = "inbound-smtp.us-east-1.amazonaws.com"
export const ZAVU_INBOUND_MX_PRIORITY = 10

export function normalizeDnsHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "")
}

export function isCurrentZavuInboundMx(host: string): boolean {
  return normalizeDnsHost(host) === ZAVU_INBOUND_MX_HOST
}

export function isReplaceableInboundMxConflict(host: string): boolean {
  const normalized = normalizeDnsHost(host)
  return (
    normalized === "inbound.zavu.dev" ||
    /^feedback-smtp\.[a-z0-9-]+\.amazonses\.com$/.test(normalized)
  )
}
