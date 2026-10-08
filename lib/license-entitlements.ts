import type { BillingLimitPayload } from "./billing-limit-errors"

export const LICENSE_PLANS = ["commission", "engine", "foundry", "enterprise"] as const
export type LicensePlan = typeof LICENSE_PLANS[number]

export interface SiteMemberLicense {
  siteId: string
  plan: LicensePlan
  current: number
  total?: number
  limit: number | null
  requiredPlan: LicensePlan
  canUpgrade: boolean
}

const MEMBER_LIMITS: Record<LicensePlan, number | null> = {
  commission: 1, engine: 5, foundry: 10, enterprise: null,
}
const SOCIAL_LIMITS: Record<LicensePlan, number> = {
  commission: 1, engine: 3, foundry: 6, enterprise: 10,
}
const CHANNEL_LIMITS: Record<LicensePlan, number> = {
  commission: 0, engine: 1, foundry: 3, enterprise: 10,
}

/** Legacy names are aliases, never an implicit paid entitlement. */
export function licensePlan(value: unknown): LicensePlan {
  if (typeof value !== "string") return "commission"
  switch (value.trim().toLowerCase()) {
    case "starter": case "engine": return "engine"
    case "startup": case "foundry": return "foundry"
    case "reactor": case "enterprise": return "enterprise"
    default: return "commission"
  }
}

export function licensePlanLabel(plan: unknown): string {
  return { commission: "Toolbox", engine: "Engine", foundry: "Foundry", enterprise: "Reactor / Enterprise" }[licensePlan(plan)]
}

export function getMemberLimit(plan: unknown): number | null {
  return MEMBER_LIMITS[licensePlan(plan)]
}

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : Number.MAX_SAFE_INTEGER
}

export function requiredMemberPlan(members: number): LicensePlan {
  const demand = count(members)
  return LICENSE_PLANS.find(plan => MEMBER_LIMITS[plan] === null || demand <= MEMBER_LIMITS[plan]!)!
}

/** Connection add-ons share a pool; they do not add member seats. */
export function requiredLicensePlan(input: {
  members: number
  socialAccounts: number
  agentChannels: number
  addons?: number
}): { plan: LicensePlan; missingConnectionAddons: number } {
  const members = count(input.members)
  const social = count(input.socialAccounts)
  const channels = count(input.agentChannels)
  const addons = Number.isFinite(input.addons) ? Math.max(0, Math.floor(input.addons ?? 0)) : 0
  const connectionsNeeded = (plan: LicensePlan) =>
    Math.max(0, social - SOCIAL_LIMITS[plan]) + Math.max(0, channels - CHANNEL_LIMITS[plan])
  const plan = LICENSE_PLANS.find(candidate =>
    (MEMBER_LIMITS[candidate] === null || members <= MEMBER_LIMITS[candidate]!) && connectionsNeeded(candidate) <= addons
  ) ?? "enterprise"
  return { plan, missingConnectionAddons: Math.max(0, connectionsNeeded(plan) - addons) }
}

export function memberUpgradePayload(siteId: string, plan: unknown, current: number, extra = 1): BillingLimitPayload {
  const limit = getMemberLimit(plan)
  const requiredPlan = requiredMemberPlan(current + extra)
  return {
    kind: "members", siteId, current, limit: limit ?? undefined, requiredPlan, canUpgrade: true,
    message: `${licensePlanLabel(requiredPlan)} is required for ${current + extra} team members.`,
  }
}