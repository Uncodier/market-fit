import type { ApiKey } from "@/lib/api-keys"
import type { AllowedDomain } from "@/app/types/domains"

export function isAutomaticApiKey(key: Pick<ApiKey, "metadata">): boolean {
  const issuer = key.metadata?.issued_by
  return issuer === "harness.requirement-provisioning" ||
    issuer === "platform-api.ensure-platform-key"
}

function createdAt(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function newestFirst<T extends { created_at: string }>(a: T, b: T): number {
  return createdAt(b.created_at) - createdAt(a.created_at)
}

export function sortApiKeysForDisplay<T extends Pick<ApiKey, "metadata" | "created_at">>(keys: readonly T[]): T[] {
  return [...keys].sort((a, b) =>
    Number(isAutomaticApiKey(a)) - Number(isAutomaticApiKey(b)) || newestFirst(a, b)
  )
}

function domainRank(domain: Pick<AllowedDomain, "source">): number {
  if (domain.source === "user") return 0
  if (domain.source === "harness") return 2
  return 1
}

export function sortAllowedDomainsForDisplay<T extends Pick<AllowedDomain, "source" | "created_at">>(domains: readonly T[]): T[] {
  return [...domains].sort((a, b) => domainRank(a) - domainRank(b) || newestFirst(a, b))
}