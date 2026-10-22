import type { CheckoutCartParams } from "@/app/commerce/checkout-types"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import { resolveAppApiUrl } from "@/app/commerce/app-api-url"

type Attempt = { id: string; digest: string }
const memory = new Map<string, Attempt>()
const pending = new Map<string, Promise<Attempt>>()
const key = (locationId: string) => `shop-self-service-attempt:${locationId}`

function readAttempt(locationId: string): Attempt | undefined {
  const existing = memory.get(locationId)
  if (existing) return existing
  if (typeof window === "undefined") return
  try {
    const stored = JSON.parse(sessionStorage.getItem(key(locationId)) || "null")
    if (stored && typeof stored.id === "string" && /^[a-f0-9-]{36}$/i.test(stored.id) && typeof stored.digest === "string") {
      memory.set(locationId, stored)
      return stored
    }
  } catch { /* Do not expose malformed local data. */ }
}

/** A reload can recover by nonce without retaining or reconstructing an account QR. */
export async function recoverSelfServiceAttempt(locationId: string): Promise<CheckoutCartSuccess | null> {
  const attempt = readAttempt(locationId)
  if (!attempt) return null
  const response = await fetch(resolveAppApiUrl("/api/commerce/checkout/recover"), {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
    body: JSON.stringify({ locationId, attemptId: attempt.id }),
  })
  const result = await response.json()
  if (response.ok && result.success === true) { finishSelfServiceAttempt(locationId, attempt.id); return result }
  if (response.ok && result.state === "not_found") return null
  throw new Error(result.error || "The previous order is unresolved. Ask staff before placing another order.")
}

/** Only an opaque attempt ID and salted digest are stored, never account QR/name/cart. */
export async function getSelfServiceAttempt(locationId: string, request: CheckoutCartParams): Promise<Attempt> {
  const active = pending.get(locationId)
  const attempt = (active ? active.catch(() => {}) : Promise.resolve()).then(() => prepareAttempt(locationId, request))
  pending.set(locationId, attempt)
  try { return await attempt } finally { if (pending.get(locationId) === attempt) pending.delete(locationId) }
}

async function prepareAttempt(locationId: string, request: CheckoutCartParams): Promise<Attempt> {
  const previous = readAttempt(locationId)
  const id = previous?.id || crypto.randomUUID()
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${id}:${JSON.stringify(request)}`))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")
  if (previous && previous.digest !== digest) throw new Error("An earlier order attempt is unresolved. Restore that order and retry, or ask staff to check it before starting another order.")
  const attempt = previous || { id, digest }
  memory.set(locationId, attempt)
  if (typeof window !== "undefined") {
    try { sessionStorage.setItem(key(locationId), JSON.stringify(attempt)) } catch { /* Keep the in-memory attempt. */ }
  }
  return attempt
}

export function finishSelfServiceAttempt(locationId: string, attemptId: string) {
  if (memory.get(locationId)?.id !== attemptId) return
  memory.delete(locationId)
  if (typeof window !== "undefined") {
    try { sessionStorage.removeItem(key(locationId)) } catch { /* Nothing else is persisted. */ }
  }
}