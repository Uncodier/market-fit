export const BILLING_LIMIT_EVENT = "billing-limit"

export const BILLING_LIMIT_CODES = {
  ACCOUNT_LIMIT: "ACCOUNT_LIMIT",
  CREDIT_LIMIT: "CREDIT_LIMIT",
} as const

export type BillingLimitKind = "accounts" | "credits"

export type BillingLimitPayload = {
  kind: BillingLimitKind
  current?: number
  limit?: number
  message?: string
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

  if (typeof input === "string") {
    const kind = kindFromMessage(input)
    return kind ? { kind, message: input } : null
  }

  const record = asRecord(input)
  if (!record) return null

  const nested = asRecord(record.error) || asRecord(record.details)
  const code = record.code ?? nested?.code
  const message =
    (typeof record.message === "string" && record.message) ||
    (typeof nested?.message === "string" && nested.message) ||
    (typeof record.error === "string" && record.error) ||
    ""

  const kind = kindFromCode(code) || kindFromMessage(message)
  if (!kind) return null

  return {
    kind,
    current: readNumber(record.current, nested?.current, record.used, nested?.used),
    limit: readNumber(record.limit, nested?.limit),
    message: message || undefined,
  }
}

export function emitBillingLimit(payload: BillingLimitPayload) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(BILLING_LIMIT_EVENT, { detail: payload }))
}

export function billingLimitApiError(
  kind: BillingLimitKind,
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
