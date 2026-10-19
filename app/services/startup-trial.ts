import { z } from "zod"
import { startupTrialSchema, type StartupTrial, type StartupTrialActivation } from "@/lib/billing/startup-trial"

export type { StartupTrial, StartupTrialActivation } from "@/lib/billing/startup-trial"

export const STARTUP_TRIAL_REQUEST_TIMEOUT_MS = 15_000
export const STARTUP_TRIAL_REFRESH_TIMEOUT_MS = 9_000

export function readStartupTrial(body: unknown): StartupTrial {
  return startupTrialSchema.parse(body)
}

export function readStartupTrialActivation(body: unknown): StartupTrialActivation {
  const trial = readStartupTrial(body)
  const { outcome } = z.object({ outcome: z.enum(["started", "already_started"]) }).parse(body)
  if (trial.state === "eligible" || trial.state === "unavailable") throw new Error("Unconfirmed activation")
  return { ...trial, outcome }
}

/** Bound the entire operation, including response bodies and transports that ignore abort. */
export async function waitForStartupTrial<T>(
  operation: () => Promise<T>, controller: AbortController, timeoutMs: number,
): Promise<T> {
  const { signal } = controller
  if (signal.aborted) throw new Error("Trial request interrupted")
  let rejectAborted: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = () => reject(new Error("Trial request interrupted"))
    signal.addEventListener("abort", rejectAborted, { once: true })
  })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await Promise.race([operation(), aborted])
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener("abort", rejectAborted)
  }
}

async function trialRequest(siteId: string, controller: AbortController, activate: boolean): Promise<unknown> {
  z.string().uuid().parse(siteId)
  return waitForStartupTrial(async () => {
    const response = await fetch(activate ? "/api/billing/startup-trial"
      : `/api/billing/startup-trial?site_id=${encodeURIComponent(siteId)}`, {
      method: activate ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      ...(activate ? {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId }),
      } : {}),
    })
    // Never expose provider diagnostics or infer eligibility from a failed request.
    if (!response.ok) throw new Error("Trial unavailable")
    return response.json()
  }, controller, STARTUP_TRIAL_REQUEST_TIMEOUT_MS)
}

export async function getStartupTrial(siteId: string, controller: AbortController): Promise<StartupTrial> {
  return readStartupTrial(await trialRequest(siteId, controller, false))
}

/** Only call from an explicit activation click; an interrupted POST is never automatically replayed. */
export async function startStartupTrial(siteId: string, controller: AbortController): Promise<StartupTrialActivation> {
  return readStartupTrialActivation(await trialRequest(siteId, controller, true))
}