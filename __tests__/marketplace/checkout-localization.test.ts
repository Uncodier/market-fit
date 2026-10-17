import { toast } from "sonner"
import { runMarketplaceCheckout } from "@/app/marketplace/run-marketplace-checkout"
import { localeMessages } from "@/app/context/locale-catalog"
import { checkoutCartRequest, createStripeOrderCheckout } from "@/app/commerce/checkout-client"
import { marketplaceItem } from "./catalog-fixture"

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))
jest.mock("@/app/commerce/checkout-client", () => ({ checkoutCartRequest: jest.fn(), createStripeOrderCheckout: jest.fn() }))
jest.mock("@/app/commerce/cart-storage", () => ({ clearCart: jest.fn() }))
jest.mock("@/app/commerce/device-order-storage", () => ({ rememberDeviceOrder: jest.fn(), toDeviceOrderItem: jest.fn() }))

type Params = Parameters<typeof runMarketplaceCheckout>[0]
const base: Omit<Params, "t"> = {
  e: { preventDefault: jest.fn() } as unknown as Params["e"],
  cart: [{ ...marketplaceItem("Test item"), cartQty: 1, cartPrice: 10 }],
  session: null, customerName: "Test buyer", customerEmail: "buyer@example.test",
  fulfillment: "none", originLocationId: "", shippingAddress: { line1: "", line2: "", city: "", state: "", zip: "", country: "" },
  paymentMethod: "cash_on_pickup", orderTiming: "now", scheduledFor: null,
  isOpen: true, nextOpenSlot: null, isLocationAvailable: true, payableTotal: 10,
  promotionCode: "", promotionId: null, ownerSiteId: null, setCheckoutLoading: jest.fn(), onSuccess: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

it.each(["en", "es", "fr", "de", "ja"] as const)("translates checkout validation failures in %s without calling the backend", async (locale) => {
  const messages = localeMessages[locale]
  const cases: Array<[Partial<Params>, string]> = [
    [{ customerName: "" }, "identityRequired"],
    [{ fulfillment: "ship" }, "shippingRequired"],
    [{ fulfillment: "pickup" }, "storeLocation"],
    [{ paymentMethod: "" }, "paymentRequired"],
    [{ cart: [...base.cart, { ...base.cart[0], site_id: "other-seller" }] }, "multipleSellers"],
  ]
  for (const [overrides, error] of cases) {
    await runMarketplaceCheckout({ ...base, ...overrides, t: (key) => messages[key] || key })
    expect(toast.error).toHaveBeenLastCalledWith(messages[`marketplace.checkout.errors.${error}`])
  }
  expect(checkoutCartRequest).not.toHaveBeenCalled()
})

it("uses translated generic errors instead of exposing server or network prose", async () => {
  const messages = localeMessages.es
  jest.mocked(checkoutCartRequest).mockResolvedValueOnce({ error: "Internal provider error" })
  const params = { ...base, t: (key: string) => messages[key] || key }
  await runMarketplaceCheckout(params)
  expect(toast.error).toHaveBeenLastCalledWith(messages["marketplace.checkout.errors.failed"])
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.mocked(checkoutCartRequest).mockRejectedValueOnce(new Error("Network failure"))
  await runMarketplaceCheckout(params)
  expect(toast.error).toHaveBeenLastCalledWith(messages["marketplace.checkout.errors.failed"])
  jest.restoreAllMocks()
})

it("localizes payment gateway failures and clears the loading state", async () => {
  const messages = localeMessages.ja
  jest.mocked(checkoutCartRequest).mockResolvedValue({ success: true, saleId: "sale", orderId: "order", publicAccessToken: "token" })
  jest.mocked(createStripeOrderCheckout).mockResolvedValue({ error: "Gateway error" })
  await runMarketplaceCheckout({ ...base, paymentMethod: "card", t: (key) => messages[key] || key })
  expect(toast.error).toHaveBeenLastCalledWith(messages["marketplace.checkout.errors.paymentFailed"])
  expect(base.setCheckoutLoading).toHaveBeenLastCalledWith(false)
  expect(base.onSuccess).not.toHaveBeenCalled()
})