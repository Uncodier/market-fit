export type BillingPlan = "engine" | "foundry" | "enterprise"

/** Unknown and free plans must never silently become a paid entitlement. */
export function normalizeBillingPlan(value: unknown): BillingPlan | null {
  if (typeof value !== "string") return null
  switch (value.trim().toLowerCase()) {
    case "starter":
    case "engine":
      return "engine"
    case "startup":
    case "foundry":
      return "foundry"
    case "enterprise":
      return "enterprise"
    default:
      return null
  }
}