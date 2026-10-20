export interface EmailDomainConnection {
  id?: string
  type?: string
  metadata?: unknown
}

export interface EmailDomainOption {
  domain: string
  previouslyVerified: boolean
}

export function normalizeEmailDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "")
}

export function isValidEmailDomain(value: string): boolean {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)
}

// Persisted site connections are suggestions, not proof of provider verification.
export function getEmailDomainOptions(
  connections: readonly EmailDomainConnection[],
  excludedChannelId?: string,
): EmailDomainOption[] {
  const domains = new Map<string, { ids: Set<string>; previouslyVerified: boolean }>()
  for (const connection of connections) {
    if (connection.type !== "email" || (excludedChannelId && connection.id === excludedChannelId)) continue
    if (!connection.metadata || typeof connection.metadata !== "object") continue
    const metadata = connection.metadata as Record<string, unknown>
    if (typeof metadata.domain !== "string" || typeof metadata.email_domain_id !== "string"
      || !metadata.email_domain_id.trim()) continue
    const domain = normalizeEmailDomain(metadata.domain)
    if (!isValidEmailDomain(domain)) continue
    const entry = domains.get(domain) || { ids: new Set<string>(), previouslyVerified: false }
    entry.ids.add(metadata.email_domain_id)
    entry.previouslyVerified ||= metadata.domain_status === "verified"
    domains.set(domain, entry)
  }
  return [...domains.entries()]
    .filter(([, entry]) => entry.ids.size === 1)
    .map(([domain, entry]) => ({ domain, previouslyVerified: entry.previouslyVerified }))
    .sort((a, b) => Number(b.previouslyVerified) - Number(a.previouslyVerified) || a.domain.localeCompare(b.domain))
}