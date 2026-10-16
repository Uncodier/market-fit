import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import CheckoutClient from "@/app/cart/checkout/CheckoutClient"
import { listPublicLocations } from "@/app/inventory/actions"
import { getSiteInfoBySlug } from "@/app/book/actions"
import { getCartKey, setCartItems } from "@/app/commerce/cart-storage"
import { readShopFulfillmentPreference, writeShopFulfillmentPreference } from "@/app/commerce/shop-fulfillment-preference"
import type { CheckoutCartParams } from "@/app/commerce/checkout"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"

jest.mock("@/app/inventory/actions", () => ({ listPublicLocations: jest.fn() }))
jest.mock("@/app/book/actions", () => ({ getSiteInfoBySlug: jest.fn() }))
jest.mock("@/app/components/auth/auth-provider", () => {
  const user = { id: "buyer", email: "buyer@example.test", user_metadata: { name: "Test Buyer" } }
  return { useAuthContext: () => ({ user, isLoading: false }) }
})
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "", locale: "en", applyUnresolvedLocale: jest.fn() }),
}))
jest.mock("@/app/hooks/useSiteTracking", () => {
  const identifyLead = jest.fn()
  return { useSiteTracking: () => ({ identifyLead }) }
})
jest.mock("@/app/components/commerce/CheckoutIdentityPicker", () => ({ CheckoutIdentityPicker: () => null }))
jest.mock("@/app/components/commerce/pdp/VenueMap", () => ({ VenueMap: () => null }))
jest.mock("@/app/components/ui/date-picker", () => ({ DatePicker: () => null }))
jest.mock("@/app/components/commerce/CommerceOrderSuccess", () => ({
  CommerceOrderSuccess: () => <h1>Order Confirmed</h1>,
}))
// Keep the real CheckoutForm and submission HTTP client; only unrelated summary UI is reduced.
jest.mock("@/app/cart/checkout/OrderSummary", () => ({
  OrderSummary: ({ fulfillment, disabledReason, shippingCost }: {
    fulfillment: string; disabledReason?: string; shippingCost: number
  }) => (
    <aside>
      <output data-testid="summary-fulfillment">{fulfillment}</output>
      <output data-testid="shipping-cost">{shippingCost}</output>
      <button type="submit" form="checkout-form" disabled={!!disabledReason}>Place order</button>
    </aside>
  ),
}))

const siteId = "seller-site"
const labels = { pickup: "Store Pickup", dine_in: "Consume Here", ship: "Ship to Me", none: "No Delivery" }
const methods: CheckoutFulfillmentMethod[] = ["pickup", "dine_in", "ship"]
const nearGeo = { latitude: "19.4326", longitude: "-99.1332", country: "MX" }
const farGeo = { latitude: "40.7128", longitude: "-74.006", country: "US" }
const nearLocation = {
  id: "pickup-location", name: "Test Store", is_active: true,
  latitude: 19.4326, longitude: -99.1332,
}
const item = {
  id: "product", site_id: siteId, name: "Test Product", kind: "product",
  currency: "USD", cartQty: 2, cartPrice: 10, site: { name: "Test Store" },
  metadata: { delivery_options: methods, payment_options: ["bank_transfer"] },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function configureCart(source = "shop", cartItem = item) {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({
    source, siteId, returnTo: "/shop/test-store",
  }) as ReturnType<typeof useSearchParams>)
  setCartItems("cart", source, siteId, [cartItem])
}

function selected(method: CheckoutFulfillmentMethod) {
  expect(screen.getByRole("button", { name: labels[method] })).toHaveClass("shadow-sm")
  expect(screen.getByTestId("summary-fulfillment")).toHaveTextContent(method)
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  window.history.replaceState({}, "", "/cart/checkout")
  ;(listPublicLocations as jest.Mock).mockResolvedValue({ data: [] })
  ;(getSiteInfoBySlug as jest.Mock).mockResolvedValue({ settings: {
    shop: { default_delivery_options: methods, payment_methods: ["bank_transfer"], shipping_cost: 7 },
  } })
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "checkout-mutation" })
  jest.mocked(fetch).mockResolvedValue({
    ok: true, status: 200,
    json: async () => ({ success: true, saleId: "sale", orderId: "order", publicAccessToken: "order-token" }),
  } as Response)
  configureCart()
})

describe("CheckoutClient Shop fulfillment restoration", () => {
  test.each(methods)("restores saved %s on an independent checkout mount", async method => {
    writeShopFulfillmentPreference(siteId, method)
    const storageWrite = jest.spyOn(Storage.prototype, "setItem")
    render(<CheckoutClient buyerGeo={farGeo} />)

    await waitFor(() => selected(method))
    expect(readShopFulfillmentPreference(siteId)).toBe(method)
    expect(storageWrite).not.toHaveBeenCalledWith(`market-shop-fulfillment:${siteId}`, expect.anything())
    storageWrite.mockRestore()
  })

  test.each(methods)("keeps restored %s through late settings and nearby location loading", async method => {
    writeShopFulfillmentPreference(siteId, method)
    const locations = deferred<{ data: typeof nearLocation[] }>()
    const settings = deferred<{ settings: { shop: { default_delivery_options: CheckoutFulfillmentMethod[] } } }>()
    ;(listPublicLocations as jest.Mock).mockReturnValue(locations.promise)
    ;(getSiteInfoBySlug as jest.Mock).mockReturnValue(settings.promise)
    const view = render(<CheckoutClient buyerGeo={farGeo} />)
    await waitFor(() => selected(method))

    await act(async () => {
      locations.resolve({ data: [nearLocation] })
      settings.resolve({ settings: { shop: { default_delivery_options: methods } } })
    })
    view.rerender(<CheckoutClient buyerGeo={nearGeo} />)
    await act(async () => { await Promise.resolve() })
    selected(method)
    expect(readShopFulfillmentPreference(siteId)).toBe(method)
  })

  test("persists only the form's explicit choice and restores it on remount", async () => {
    const locations = deferred<{ data: typeof nearLocation[] }>()
    ;(listPublicLocations as jest.Mock).mockReturnValue(locations.promise)
    const view = render(<CheckoutClient buyerGeo={nearGeo} />)
    await waitFor(() => selected("ship"))
    expect(readShopFulfillmentPreference(siteId)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Consume Here" }))
    selected("dine_in")
    expect(localStorage.getItem(`market-shop-fulfillment:${siteId}`)).toBe("dine_in")
    await act(async () => { locations.resolve({ data: [nearLocation] }) })
    selected("dine_in")

    view.unmount()
    render(<CheckoutClient buyerGeo={nearGeo} />)
    await waitFor(() => selected("dine_in"))
  })

  test("without an explicit preference, late nearby data still defaults to pickup without persisting", async () => {
    const locations = deferred<{ data: typeof nearLocation[] }>()
    ;(listPublicLocations as jest.Mock).mockReturnValue(locations.promise)
    render(<CheckoutClient buyerGeo={nearGeo} />)
    await waitFor(() => selected("ship"))
    await act(async () => { locations.resolve({ data: [nearLocation] }) })
    await waitFor(() => selected("pickup"))
    expect(readShopFulfillmentPreference(siteId)).toBeNull()
  })

  test("ignores the Shop preference in marketplace and never overwrites it", async () => {
    writeShopFulfillmentPreference(siteId, "dine_in")
    configureCart("marketplace")
    render(<CheckoutClient buyerGeo={farGeo} />)
    await waitFor(() => selected("ship"))
    fireEvent.click(screen.getByRole("button", { name: "Store Pickup" }))
    selected("pickup")
    expect(readShopFulfillmentPreference(siteId)).toBe("dine_in")
  })

  test("falls back for incompatible items without deleting the saved preference", async () => {
    writeShopFulfillmentPreference(siteId, "dine_in")
    configureCart("shop", { ...item, metadata: { ...item.metadata, delivery_options: ["ship"] } })
    render(<CheckoutClient />)
    await waitFor(() => selected("ship"))
    expect(screen.queryByRole("button", { name: "Consume Here" })).not.toBeInTheDocument()
    expect(readShopFulfillmentPreference(siteId)).toBe("dine_in")
    expect(localStorage.getItem(`market-shop-fulfillment:${siteId}`)).toBe("dine_in")
  })

  test("ignores another seller's preference", async () => {
    writeShopFulfillmentPreference("another-seller", "pickup")
    render(<CheckoutClient buyerGeo={farGeo} />)
    await waitFor(() => selected("ship"))
    expect(readShopFulfillmentPreference(siteId)).toBeNull()
    expect(readShopFulfillmentPreference("another-seller")).toBe("pickup")
  })

  test.each(methods)("submits restored %s in the checkout HTTP request", async method => {
    writeShopFulfillmentPreference(siteId, method)
    ;(listPublicLocations as jest.Mock).mockResolvedValue({ data: [nearLocation] })
    render(<CheckoutClient buyerGeo={nearGeo} />)
    await waitFor(() => selected(method))
    await waitFor(() => expect(screen.getByRole("button", { name: "Place order" })).toBeEnabled())
    if (method === "ship") {
      fireEvent.change(screen.getByPlaceholderText("Street Address"), { target: { value: "1 Test Street" } })
      fireEvent.change(screen.getByPlaceholderText("City"), { target: { value: "Test City" } })
      fireEvent.change(screen.getByPlaceholderText("ZIP Code"), { target: { value: "12345" } })
      expect(screen.getByTestId("shipping-cost")).toHaveTextContent("7")
    }
    fireEvent.submit(document.getElementById("checkout-form")!)

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    const [url, request] = jest.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain("/api/commerce/checkout")
    expect(request).toMatchObject({ method: "POST", credentials: "include" })
    const payload = JSON.parse(String(request?.body)) as CheckoutCartParams
    expect(payload).toMatchObject({
      siteId, source: "shop", fulfillment: method, paymentMethod: "bank_transfer", intent: "send",
      lines: [{ catalogItemId: "product", quantity: 2, unitPriceOverride: 10 }],
    })
    if (method === "ship") {
      expect(payload.shippingAddress).toMatchObject({ line1: "1 Test Street", city: "Test City", zip: "12345" })
      expect(payload.originLocationId).toBeUndefined()
    } else {
      expect(payload.originLocationId).toBe("pickup-location")
      expect(payload.shippingAddress).toBeUndefined()
    }
    await screen.findByRole("heading", { name: "Order Confirmed" })
    expect(localStorage.getItem(getCartKey("cart", "shop", siteId))).toBeNull()
    expect(readShopFulfillmentPreference(siteId)).toBe(method)
  })
})