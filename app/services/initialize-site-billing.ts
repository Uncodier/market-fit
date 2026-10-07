import { z } from "zod"
import { withTimeout } from "./request-timeout"

export const BILLING_REFRESH_WAIT_MS = 9_000

const responseSchema = z.object({
  success: z.literal(true),
  outcome: z.enum(["initialized", "already_initialized"]),
})

export const BILLING_INITIALIZATION_WARNING = "Your project is saved, but initial credits could not be confirmed. Do not recreate the project. Retry billing setup here or open Billing later."
export const BILLING_UNAVAILABLE_WARNING = "Your project is saved, but billing initialization is currently unavailable. Do not recreate the project. Retry billing setup later or contact support."
export const BILLING_REFRESH_WARNING = "Billing setup is confirmed, but the latest credit balance could not be loaded. Refresh credits in Billing; do not recreate the project."

/** Retry only this idempotent database operation, never site creation or workflow setup. */
export async function initializeSiteBilling(siteId: string): Promise<void> {
  let unavailable = false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch("/api/billing/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ site_id: siteId }),
      cache: "no-store",
      signal: controller.signal,
    })
    const result = await response.json()
    unavailable = !response.ok && result?.error?.code === "BILLING_INITIALIZATION_UNAVAILABLE"
    if (!response.ok || !responseSchema.safeParse(result).success) throw new Error("Unconfirmed billing")
  } catch {
    // Upstream messages are deliberately not displayed to the user.
    throw new Error(unavailable ? BILLING_UNAVAILABLE_WARNING : BILLING_INITIALIZATION_WARNING)
  } finally {
    clearTimeout(timeout)
  }
}

export async function prepareSiteBilling(siteId: string, refresh: (siteId: string) => Promise<void>): Promise<string | null> {
  try {
    await initializeSiteBilling(siteId)
  } catch (error) {
    return error instanceof Error && error.message === BILLING_UNAVAILABLE_WARNING
      ? BILLING_UNAVAILABLE_WARNING : BILLING_INITIALIZATION_WARNING
  }
  try {
    await withTimeout(refresh(siteId), BILLING_REFRESH_WAIT_MS, BILLING_REFRESH_WARNING)
    return null
  } catch {
    return BILLING_REFRESH_WARNING
  }
}