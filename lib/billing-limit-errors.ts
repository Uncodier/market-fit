import type { LicensePlan } from "./license-entitlements"

export const BILLING_LIMIT_EVENT = "billing-limit"

export const BILLING_LIMIT_CODES = {
  ACCOUNT_LIMIT: "ACCOUNT_LIMIT",
  CREDIT_LIMIT: "CREDIT_LIMIT",
  MEMBER_LIMIT: "MEMBER_LIMIT",
} as const

export type BillingLimitKind = "accounts" | "credits" | "members"

export type BillingLimitPayload = {
  kind: BillingLimitKind
  current?: number
  limit?: number | null
  message?: string
  siteId?: string
  requiredPlan?: LicensePlan
  canUpgrade?: boolean
}

export class BillingUpgradeRequired extends Error {
  readonly payload: BillingLimitPayload

  constructor(payload: BillingLimitPayload) {
    super(payload.message || "A license upgrade is required to continue.")
    this.name = "BillingUpgradeRequired"
    this.payload = payload
  }
}

export function isBillingUpgradeRequired(error: unknown): error is BillingUpgradeRequired {
  return error instanceof BillingUpgradeRequired
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function kindFromCode(code: unknown): BillingLimitKind | null {
  if (code === BILLING_LIMIT_CODES.ACCOUNT_LIMIT) return "accounts"
  if (code === BILLING_LIMIT_CODES.CREDIT_LIMIT) return "credits"
  if (code === BILLING_LIMIT_CODES.MEMBER_LIMIT) return "members"
  return null
}

function kindFromMessage(message: string): BillingLimitKind | null {
  const text = message.toLowerCase()
  if (
    text.includes("account limit") ||
    text.includes("addon") ||
    text.includes("add-on") ||
    text.includes("connected account")
  ) {
    return "accounts"
  }
  if (
    text.includes("insufficient credit") ||
    text.includes("not enough credit") ||
    text.includes("credit limit") ||
    text.includes("out of credit") ||
    text.includes("no credits")
  ) {
    return "credits"
  }
  return null
}

export function parseBillingLimitError(input: unknown): BillingLimitPayload | null {
  if (!input) return null
  if (isBillingUpgradeRequired(input)) return input.payload

  if (typeof input === "string") {
    const kind = kindFromMessage(input)
    return kind ? { kind, message: input } : null
  }

  const record = asRecord(input)
  if (!record) return null

  const nested = asRecord(record.upgradeRequired) || asRecord(record.payload) || asRecord(record.error) || asRecord(record.details)
  const code = record.code ?? nested?.code
  const message =
    (typeof record.message === "string" && record.message) ||
    (typeof nested?.message === "string" && nested.message) ||
    (typeof record.error === "string" && record.error) ||
    ""

  const explicitKind = record.kind ?? nested?.kind
  const kind = kindFromCode(code) ||
    (explicitKind === "members" || explicitKind === "accounts" || explicitKind === "credits" ? explicitKind : null) ||
    kindFromMessage(message)
  if (!kind) return null

  const siteId = record.siteId ?? nested?.siteId
  const requiredPlan = record.requiredPlan ?? nested?.requiredPlan
  const canUpgrade = record.canUpgrade ?? nested?.canUpgrade
  const validPlan = requiredPlan === "commission" || requiredPlan === "engine" || requiredPlan === "foundry" || requiredPlan === "enterprise"
  // A member limit must be structured; an unavailable license RPC is not an entitlement.
  if (kind === "members" && (typeof siteId !== "string" || !siteId || !validPlan || typeof canUpgrade !== "boolean")) return null

  return {
    kind,
    current: readNumber(record.current, nested?.current, record.used, nested?.used),
    limit: record.limit === null || nested?.limit === null ? null : readNumber(record.limit, nested?.limit),
    message: message || undefined,
    ...(kind === "members" ? { siteId: siteId as string, requiredPlan: requiredPlan as LicensePlan, canUpgrade: canUpgrade as boolean } : {}),
  }
}

export function emitBillingLimit(payload: BillingLimitPayload) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(BILLING_LIMIT_EVENT, { detail: payload }))
}

export function billingLimitApiError(
  kind: Exclude<BillingLimitKind, "members">,
  current: number,
  limit: number,
  message?: string
) {
  const code = kind === "accounts" ? BILLING_LIMIT_CODES.ACCOUNT_LIMIT : BILLING_LIMIT_CODES.CREDIT_LIMIT
  return {
    success: false,
    error: {
      message:
        message ||
        (kind === "accounts"
          ? `Account limit reached (${current}/${limit}). Upgrade plan or get an account add-on.`
          : `Credit limit reached. Please buy credits or upgrade your plan.`),
      code,
      current,
      limit,
    },
  }
}
