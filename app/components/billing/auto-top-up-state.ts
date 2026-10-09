export type TopUpConfig = {
  enabled: boolean
  minimumCredits: number
  targetCredits: number
  maxMonthlySpendCents: number
}

export type TopUpSettings = TopUpConfig & {
  paymentMethodReady: boolean
  billingCardAvailable?: boolean
  paymentMethod?: { brand: string; last4: string; expMonth: number; expYear: number } | null
  paymentMethodSource?: "billing" | "top_up" | null
  billingCardFingerprint?: string
  state: string
  pending?: boolean
  needsAttention?: boolean
}

export type TopUpDraft = {
  enabled: boolean
  minimumCredits: string
  targetCredits: string
  monthlySpend: string
}

const defaults: TopUpSettings = {
  enabled: false, minimumCredits: 5, targetCredits: 20,
  maxMonthlySpendCents: 10000, paymentMethodReady: false, state: "ready",
  billingCardAvailable: false, paymentMethod: null, paymentMethodSource: null,
}

export function validTopUpConfig(config: TopUpConfig) {
  return Number.isFinite(config.minimumCredits) && config.minimumCredits >= 0 &&
    Number.isFinite(config.targetCredits) && config.targetCredits > config.minimumCredits &&
    config.targetCredits <= 10000 && Number.isSafeInteger(config.maxMonthlySpendCents) &&
    config.maxMonthlySpendCents >= 100 && config.maxMonthlySpendCents <= 100000
}

export function topUpDraft(settings: TopUpSettings): TopUpDraft {
  return {
    enabled: settings.enabled,
    minimumCredits: String(settings.minimumCredits),
    targetCredits: String(settings.targetCredits),
    monthlySpend: String(settings.maxMonthlySpendCents / 100),
  }
}

export function draftConfig(draft: TopUpDraft): TopUpConfig | null {
  if (![draft.minimumCredits, draft.targetCredits, draft.monthlySpend].every(value => value.trim())) return null
  const config = {
    enabled: draft.enabled,
    minimumCredits: Number(draft.minimumCredits),
    targetCredits: Number(draft.targetCredits),
    maxMonthlySpendCents: Math.round(Number(draft.monthlySpend) * 100),
  }
  return validTopUpConfig(config) ? config : null
}

export function readTopUpSettings(body: Record<string, unknown>): TopUpSettings {
  if (body.settings === null) return { ...defaults }
  const settings = body.settings as TopUpSettings | undefined
  if (!settings || typeof settings.enabled !== "boolean" ||
      typeof settings.paymentMethodReady !== "boolean" || typeof settings.state !== "string" ||
      (settings.billingCardAvailable !== undefined && typeof settings.billingCardAvailable !== "boolean") ||
      (settings.paymentMethodSource != null && !["billing", "top_up"].includes(settings.paymentMethodSource)) ||
      (settings.billingCardFingerprint !== undefined &&
        (typeof settings.billingCardFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(settings.billingCardFingerprint))) ||
      (settings.paymentMethod != null && !validPaymentMethod(settings.paymentMethod)) ||
      (settings.pending !== undefined && typeof settings.pending !== "boolean") ||
      (settings.needsAttention !== undefined && typeof settings.needsAttention !== "boolean") ||
      !validTopUpConfig(settings)) throw new Error("Invalid automatic top-up settings")
  return { ...defaults, ...settings }
}

function validPaymentMethod(method: NonNullable<TopUpSettings["paymentMethod"]>) {
  return typeof method === "object" && !Array.isArray(method) &&
    typeof method.brand === "string" && Boolean(method.brand.trim()) &&
    typeof method.last4 === "string" && /^\d{4}$/.test(method.last4) &&
    Number.isInteger(method.expMonth) && method.expMonth >= 1 && method.expMonth <= 12 &&
    Number.isInteger(method.expYear) && method.expYear > 0
}

export const TOP_UP_REQUEST_TIMEOUT_MS = 15000

// Bound both the response and its body, even if a transport ignores cancellation.
// Aborting a POST does not mean the server cancelled it; callers must not retry it automatically.
export async function topUpRequest(url: string, controller: AbortController, init?: RequestInit) {
  const { signal } = controller
  let rejectAborted: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = () => reject(new Error("Automatic top-up request interrupted"))
    signal.addEventListener("abort", rejectAborted, { once: true })
    if (signal.aborted) rejectAborted()
  })
  const timer = setTimeout(() => controller.abort(), TOP_UP_REQUEST_TIMEOUT_MS)
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, cache: "no-store", signal })
        if (!response.ok) throw new Error("Automatic top-up unavailable")
        const body: unknown = await response.json()
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid response")
        return body as Record<string, unknown>
      })(),
      aborted,
    ])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", rejectAborted)
  }
}