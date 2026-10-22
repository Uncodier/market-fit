import { webcrypto } from "node:crypto"
import { TextEncoder } from "node:util"
import { checkoutCartRequest } from "@/app/commerce/checkout-client"
import { runSelfServiceCheckout } from "@/app/shop/[siteSlug]/self-service/run-self-service-checkout"
import { shopItem } from "./catalog-fixture"

jest.mock("@/app/commerce/checkout-client", () => ({ checkoutCartRequest: jest.fn() }))
const success = { success: true as const, saleId: "sale", orderId: "order", publicAccessToken: "opaque", orderNumber: "123", total: 25 }

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true })
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true })
})
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); jest.mocked(checkoutCartRequest).mockResolvedValue(success)
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ state: "not_found" }) } as Response)
})

it("uses anonymous cash draft checkout and sends modifier identities/quantities without price overrides", async () => {
  const result = await runSelfServiceCheckout({ siteId: "site", locationId: "location", fulfillment: "pickup", cart: [{ ...shopItem("coffee", "Coffee"), cartQty: 2, cartPrice: 999,
    lineKey: "configured", modifiers: [{ groupId: "milk", catalogItemId: "oat", cartQty: 1, cartPrice: 999, name: "Oat" }] }] })
  expect(result).toEqual(success)
  expect(checkoutCartRequest).toHaveBeenCalledWith(expect.objectContaining({ source: "shop", selfServiceLocationId: "location", originLocationId: "location", paymentMethod: "cash", intent: "draft",
    lines: [{ catalogItemId: "coffee", quantity: 2, clientLineKey: "configured", modifiers: [{ catalogItemId: "oat", quantity: 1, groupId: "milk" }] }] }))
  const request = jest.mocked(checkoutCartRequest).mock.calls[0][0]
  expect(request.buyerUserId).toBeUndefined()
  expect(request.customerEmail).toBeUndefined()
  expect(request.customerName).toBeUndefined()
  expect(localStorage.length).toBe(0)
})

it("passes only the signed buyer code and selected promotion", async () => {
  await runSelfServiceCheckout({ siteId: "site", locationId: "location", fulfillment: "dine_in", buyerIdentityQr: "mf:buyer:payload.signature", promotion: { id: "offer" }, cart: [] })
  expect(checkoutCartRequest).toHaveBeenCalledWith(expect.objectContaining({ buyerIdentityQr: "mf:buyer:payload.signature", promotionId: "offer", fulfillment: "dine_in" }))
})

it("surfaces server validation failures without clearing the cart", async () => {
  jest.mocked(checkoutCartRequest).mockResolvedValue({ error: "This buyer QR has expired", checkoutState: "rejected" })
  await expect(runSelfServiceCheckout({ siteId: "site", locationId: "location", fulfillment: "pickup", cart: [] })).rejects.toThrow("This buyer QR has expired")
})

it("retries an uncertain order using the same nonce and blocks changed requests", async () => {
  const params = { siteId: "site", locationId: "uncertain-location", fulfillment: "pickup" as const, cart: [] }
  jest.mocked(checkoutCartRequest).mockResolvedValueOnce({ error: "Confirmation failed", checkoutState: "uncertain" }).mockResolvedValueOnce(success)
  await expect(runSelfServiceCheckout(params)).rejects.toThrow("Confirmation failed")
  const stored = sessionStorage.getItem("shop-self-service-attempt:uncertain-location")!
  expect(Object.keys(JSON.parse(stored)).sort()).toEqual(["digest", "id"])
  await expect(runSelfServiceCheckout({ ...params, notes: "changed" })).rejects.toThrow("unresolved")
  await runSelfServiceCheckout(params)
  expect(jest.mocked(checkoutCartRequest).mock.calls[0][0].clientMutationId).toBe(jest.mocked(checkoutCartRequest).mock.calls[1][0].clientMutationId)
  expect(sessionStorage.getItem("shop-self-service-attempt:uncertain-location")).toBeNull()
})

it("recovers confirmation after transient identity and notes are lost without resubmitting checkout", async () => {
  const request = { siteId: "site", locationId: "reload-location", fulfillment: "dine_in" as const, cart: [], buyerIdentityQr: "signed-secret-qr", notes: "private notes" }
  jest.mocked(checkoutCartRequest).mockResolvedValueOnce({ error: "Lost response", checkoutState: "uncertain" })
  await expect(runSelfServiceCheckout(request)).rejects.toThrow("Lost response")
  const stored = sessionStorage.getItem("shop-self-service-attempt:reload-location")!
  expect(stored).not.toMatch(/signed-secret|private notes/)
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => success } as Response)
  expect(await runSelfServiceCheckout({ ...request, buyerIdentityQr: undefined, notes: undefined, fulfillment: "pickup" })).toEqual(success)
  expect(checkoutCartRequest).toHaveBeenCalledTimes(1)
  expect(sessionStorage.getItem("shop-self-service-attempt:reload-location")).toBeNull()
})