import React from "react"
import { act, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { LocalizationProvider, useLocalization } from "@/app/context/LocalizationContext"
import { useCheckoutSubmission, type CheckoutSubmissionParams } from "@/app/cart/checkout/use-checkout-submission"
import { checkoutCartRequest, createStripeOrderCheckout } from "@/app/commerce/checkout-client"

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))
jest.mock("@/app/commerce/checkout-client", () => ({
  checkoutCartRequest: jest.fn(), createStripeOrderCheckout: jest.fn(),
}))

const defaults: Omit<CheckoutSubmissionParams, "t"> = {
  items: [{ id: "item", site_id: "seller", cartQty: 1, name: "Item", currency: "USD" }],
  session: null, siteId: "seller", source: "marketplace", mode: "cart", returnTo: "/marketplace",
  initialOwnerSiteId: null, ownerSiteId: null, quotationId: null, publicAccessToken: null,
  fulfillment: "none", shippingAddress: { line1: "", line2: "", city: "", state: "", zip: "", country: "" },
  pickupLocationId: "", paymentMethod: "bank_transfer", promotionCode: "", payableTotal: 10,
  customerName: "Buyer", customerEmail: "buyer@example.test", requiresAuth: false,
  isLocationAvailable: true, isPurelyReservableOrDigital: true, orderTiming: "now", scheduledFor: null,
  orderNotes: "", isOpen: true, nextOpenSlot: null,
  setItems: jest.fn(), setSuccessOrderToken: jest.fn(), setSuccessPaymentMethod: jest.fn(), setOrderSuccess: jest.fn(),
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <LocalizationProvider preferredLocale="es">{children}</LocalizationProvider>
}

async function submit(overrides: Partial<CheckoutSubmissionParams> = {}) {
  const { result } = renderHook(() => {
    const { t } = useLocalization()
    return useCheckoutSubmission({ ...defaults, ...overrides, t })
  }, { wrapper })
  const preventDefault = jest.fn()
  await act(async () => {
    await result.current.handleCheckout({ preventDefault } as unknown as React.FormEvent)
  })
  expect(preventDefault).toHaveBeenCalled()
  expect(result.current.checkoutLoading).toBe(false)
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

test("localizes contact validation and makes no checkout request", async () => {
  await submit({ customerName: "" })
  expect(toast.error).toHaveBeenCalledWith("Introduce tu nombre y correo electrónico")
  expect(checkoutCartRequest).not.toHaveBeenCalled()
})

test("localizes missing payment validation without changing submission behavior", async () => {
  await submit({ paymentMethod: "" })
  expect(toast.error).toHaveBeenCalledWith("Selecciona un método de pago.")
  expect(checkoutCartRequest).not.toHaveBeenCalled()
})

test("uses a safe localized fallback for checkout responses instead of raw backend prose", async () => {
  jest.mocked(checkoutCartRequest).mockResolvedValue({ error: "Private backend error" })
  await submit()
  expect(toast.error).toHaveBeenCalledWith("No se pudo completar la compra. Inténtalo de nuevo.")
  expect(toast.error).not.toHaveBeenCalledWith("Private backend error")
})

test("uses a localized payment failure when Stripe cannot provide a redirect", async () => {
  jest.mocked(checkoutCartRequest).mockResolvedValue({ success: true, saleId: "sale", orderId: "order", publicAccessToken: "token" })
  jest.mocked(createStripeOrderCheckout).mockResolvedValue({ error: "Private payment error" })
  await submit({ paymentMethod: "card" })
  expect(toast.error).toHaveBeenCalledWith("No se pudo iniciar el pago")
  expect(createStripeOrderCheckout).toHaveBeenCalledWith(expect.objectContaining({ orderId: "order", publicAccessToken: "token" }))
})