const PAYOUT_RESOLVER_ROLES = new Set(["super_admin", "finance_admin"])

export function isPayoutResolverRole(role: unknown): boolean {
  return typeof role === "string" && PAYOUT_RESOLVER_ROLES.has(role)
}
