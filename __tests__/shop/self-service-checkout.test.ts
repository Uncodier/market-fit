import { checkoutCartRequest } from "@/app/commerce/checkout-client"
import { runSelfServiceCheckout } from "@/app/shop/[siteSlug]/self-service/run-self-service-checkout"
import { shopItem } from "./catalog-fixture"

jest.mock("@/app/commerce/checkout-client", () => ({ checkoutCartRequest: jest.fn() }))
const success = { success: true as const, saleId: "sale", orderId: "order", publicAccessToken: "opaque", orderNumber: "123", total: 25 }

beforeEach(() => { jest.clearAllMocks(); jest.mocked(checkoutCartRequest).mockResolvedValue(success) })

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
  jest.mocked(checkoutCartRequest).mockResolvedValue({ error: "This buyer QR has expired" })
  await expect(runSelfServiceCheckout({ siteId: "site", locationId: "location", fulfillment: "pickup", cart: [] })).rejects.toThrow("This buyer QR has expired")
})