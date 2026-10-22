/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/app/documents/public-token-store", () => ({ ensurePublicAccessTokenForRecord: jest.fn() }))
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"
import { claimCheckoutMutation, completeCheckoutMutation } from "@/app/commerce/checkout-idempotency"
import { markPublicCheckoutReady, publicCheckoutFingerprint, recoverPublicCheckout } from "@/app/commerce/public-checkout-recovery"
import type { CheckoutCartParams } from "@/app/commerce/checkout-types"

const token = "a".repeat(32)
const params: CheckoutCartParams = { siteId: "site", source: "shop", fulfillment: "pickup", lines: [{ catalogItemId: "item", quantity: 1 }], clientMutationId: "attempt" }
function database() {
  let mutation: Record<string, unknown> | null = null
  const order = { id: "order", sale_id: "sale", site_id: "site", public_access_token: null as string | null, public_access_token_revoked_at: null as string | null, status: "pending", total: 20, currency: "USD", order_number: "K-123" }
  const writes: string[] = []
  const client = { from: (table: string) => {
    const filters: Record<string, unknown> = {}
    let patch: Record<string, unknown> | undefined
    let expected: Record<string, unknown> | undefined
    const result = () => {
      if (table === "sale_orders") return { data: Object.entries(filters).every(([k, v]) => order[k as keyof typeof order] === v) ? order : null, error: null }
      const matches = mutation && Object.entries(filters).every(([k, v]) => mutation![k] === v) && (!expected || Object.entries(expected).every(([k, v]) => (mutation!.result as Record<string, unknown>)[k] === v))
      if (matches && patch) { mutation = { ...mutation, ...patch }; writes.push("mutation-update") }
      return { data: matches ? mutation : null, error: null }
    }
    const query = { select: () => query, eq: (k: string, v: unknown) => { filters[k] = v; return query },
      contains: (_k: string, v: Record<string, unknown>) => { expected = v; return query },
      update: (v: Record<string, unknown>) => { patch = v; return query },
      insert: async (v: Record<string, unknown>) => {
        if (mutation) return { error: { code: "23505" } }
        mutation = { id: "mutation", ...v }; writes.push("mutation-insert"); return { error: null }
      }, maybeSingle: async () => result(), single: async () => result() }
    return query
  } }
  return { client, order, writes, mutation: () => mutation }
}

it("binds retries to canonical payload and actor without storing raw account QR or name", () => {
  expect(publicCheckoutFingerprint(params, "buyer")).toBe(publicCheckoutFingerprint({ ...params, clientMutationId: "other" }, "buyer"))
  expect(publicCheckoutFingerprint(params, "buyer")).not.toBe(publicCheckoutFingerprint(params, "other"))
  expect(publicCheckoutFingerprint(params, "buyer")).not.toBe(publicCheckoutFingerprint({ ...params, lines: [{ catalogItemId: "other", quantity: 1 }] }, "buyer"))
})

it("recovers the same completed commerce records after token creation failed without replaying checkout", async () => {
  const { client, order, writes } = database()
  const fingerprint = publicCheckoutFingerprint(params, null)
  const claim = await claimCheckoutMutation(client, { siteId: "site", clientMutationId: "attempt", source: "shop", fingerprint })
  if (claim.state !== "claimed") throw new Error("Expected new claim")
  const identity = { siteId: "site", clientMutationId: "attempt", ownerToken: claim.ownerToken, fingerprint }
  await markPublicCheckoutReady(client, identity, { sale: { id: "sale" }, order: { id: "order" } })
  jest.mocked(ensurePublicAccessTokenForRecord).mockResolvedValueOnce({ error: "temporary database failure" })
  const ready = await claimCheckoutMutation(client, { ...identity, source: "shop" })
  if (ready.state !== "ready") throw new Error("Expected recoverable confirmation")
  await expect(recoverPublicCheckout(client, "site", ready.result, identity)).rejects.toThrow("order link")
  jest.mocked(ensurePublicAccessTokenForRecord).mockImplementationOnce(async () => { order.public_access_token = token; return { token } })
  expect(await recoverPublicCheckout(client, "site", ready.result, identity)).toMatchObject({ success: true, orderId: "order", saleId: "sale", publicAccessToken: token })
  const completed = await claimCheckoutMutation(client, { ...identity, source: "shop" })
  expect(completed.state).toBe("completed")
  expect(writes.filter((value) => value === "mutation-insert")).toHaveLength(1)
  expect((await claimCheckoutMutation(client, { ...identity, source: "shop", fingerprint: "different" })).state).toBe("error")
})

it("does not recover across tenants or re-enable a revoked link", async () => {
  const { client, order } = database()
  const result = { orderId: "order", saleId: "sale" }
  await expect(recoverPublicCheckout(client, "foreign", result)).rejects.toThrow("Unable to recover")
  order.public_access_token = token
  order.public_access_token_revoked_at = "2026-01-01T00:00:00Z"
  await expect(recoverPublicCheckout(client, "site", result)).rejects.toThrow("no longer available")
})

it("a failed compare-and-set cannot be reported as completed", async () => {
  await expect(completeCheckoutMutation(database().client, { siteId: "site", clientMutationId: "missing", ownerToken: "bad", result: {} })).rejects.toThrow("Failed to complete")
})