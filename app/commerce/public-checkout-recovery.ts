import "server-only"
import { createHash } from "node:crypto"
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"
import { isPublicAccessTokenActive, isValidPublicAccessToken } from "@/app/documents/public-token"
import type { CheckoutCartParams, CheckoutSupabaseClient } from "./checkout-types"
import type { CheckoutCartSuccess } from "./checkout-client"
import { completeCheckoutMutation } from "./checkout-idempotency"

export type PublicCheckoutClaim = { siteId: string; clientMutationId: string; ownerToken: string; fingerprint: string; recoveryLocationId?: string }

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return value
}

/** Hash includes actor and normalized request, not a reusable identity or raw PII. */
export function publicCheckoutFingerprint(params: CheckoutCartParams, actorId: string | null) {
  const request = { ...params, clientMutationId: undefined }
  return createHash("sha256").update(JSON.stringify(canonical({ request, actorId: params.selfServiceLocationId ? null : actorId }))).digest("hex")
}

export async function markPublicCheckoutReady(client: CheckoutSupabaseClient, claim: PublicCheckoutClaim, records: { sale: { id: string }; order: { id: string } }) {
  const { error, data } = await client.from("pos_client_mutations").update({
    sale_id: records.sale.id, order_id: records.order.id,
    result: { state: "ready", ownerToken: claim.ownerToken, fingerprint: claim.fingerprint, recoveryLocationId: claim.recoveryLocationId, saleId: records.sale.id, orderId: records.order.id },
  }).eq("site_id", claim.siteId).eq("client_mutation_id", claim.clientMutationId)
    .contains("result", { ownerToken: claim.ownerToken }).select("id").maybeSingle()
  if (error || !data) throw new Error("Unable to record order confirmation. Retry this same attempt; do not place another order.")
}

export async function recoverPublicCheckout(
  client: CheckoutSupabaseClient, siteId: string, result: Record<string, unknown>, claim?: PublicCheckoutClaim,
): Promise<CheckoutCartSuccess> {
  if (typeof result.orderId !== "string" || typeof result.saleId !== "string") throw new Error("Order confirmation requires review.")
  const { data: order, error } = await client.from("sale_orders")
    .select("id, sale_id, order_number, status, total, currency, created_at, notes, fulfillment_method, public_access_token, public_access_token_expires_at, public_access_token_revoked_at")
    .eq("site_id", siteId).eq("id", result.orderId).eq("sale_id", result.saleId).single()
  if (error || !order) throw new Error("Unable to recover your order confirmation. Retry this same attempt.")
  if (order.public_access_token && !isPublicAccessTokenActive(order)) throw new Error("The order link is no longer available. Ask staff for assistance.")
  const token = isValidPublicAccessToken(order.public_access_token) ? order.public_access_token
    : (await ensurePublicAccessTokenForRecord(client, "sale_orders", order.id)).token
  if (!token) throw new Error("Unable to recover your order link. Retry this same attempt.")
  const recovered: CheckoutCartSuccess = { success: true, saleId: order.sale_id, orderId: order.id,
    publicAccessToken: token, orderNumber: order.order_number, status: order.status, total: order.total,
    currency: order.currency, createdAt: order.created_at, notes: order.notes, fulfillment: order.fulfillment_method }
  if (claim) await completeCheckoutMutation(client, { ...claim, result: recovered })
  return recovered
}