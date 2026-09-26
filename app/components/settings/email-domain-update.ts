interface EmailDomainUpdate {
  status?: string
  dnsRecords?: unknown
}

export function buildEmailDomainUpdate(
  metadata: Record<string, any>,
  updatedDomain: EmailDomainUpdate,
  emailChannelActive: boolean
) {
  const domainStatus = updatedDomain.status || "pending"
  return {
    status: domainStatus === "failed"
      ? "failed"
      : emailChannelActive
        ? "connected"
        : "in_progress",
    metadata: {
      ...metadata,
      domain_status: domainStatus,
      dns_records: updatedDomain.dnsRecords || metadata.dns_records,
    },
  }
}