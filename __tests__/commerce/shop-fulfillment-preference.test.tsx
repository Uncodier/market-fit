import { StrictMode, useState } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"
import { readShopFulfillmentPreference, writeShopFulfillmentPreference } from "@/app/commerce/shop-fulfillment-preference"
import { useShopFulfillmentPreference } from "@/app/commerce/use-shop-fulfillment-preference"
import { useNearbyCheckoutDefaults } from "@/app/commerce/use-nearby-checkout-defaults"

const physicalOptions: CheckoutFulfillmentMethod[] = ["pickup", "ship", "dine_in"]

function useCheckout({
  siteId = "site-1",
  allowedOptions = physicalOptions,
  nearby = false,
  enabled = true,
}: {
  siteId?: string | null
  allowedOptions?: CheckoutFulfillmentMethod[]
  nearby?: boolean
  enabled?: boolean
} = {}) {
  const [fulfillment, setFulfillment] = useState<CheckoutFulfillmentMethod>("ship")
  const [paymentMethod, setPaymentMethod] = useState("")
  const preference = useShopFulfillmentPreference({ siteId, setFulfillment })
  useNearbyCheckoutDefaults({
    fulfillment, setFulfillment, allowedOptions,
    paymentMethod, setPaymentMethod,
    availablePaymentMethods: ["card", "cash_on_pickup"],
    selectedLocationId: nearby ? "store-1" : null,
    userChoseFulfillmentRef: preference.userChoseFulfillmentRef,
    enabled: enabled && preference.isPreferenceLoaded,
  })
  return { fulfillment, paymentMethod, ...preference }
}

describe("Shop fulfillment preference", () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => jest.restoreAllMocks())

  it.each<CheckoutFulfillmentMethod>(["pickup", "ship", "dine_in", "none"])("persists and validates %s per shop", (method) => {
    writeShopFulfillmentPreference("site-1", method)
    expect(readShopFulfillmentPreference("site-1")).toBe(method)
    expect(readShopFulfillmentPreference("site-2")).toBeNull()
    expect(readShopFulfillmentPreference(null)).toBeNull()
  })

  it.each(["invalid", '"pickup"', "{}", "null", ""])("ignores malformed stored value %s", (value) => {
    localStorage.setItem("market-shop-fulfillment:site-1", value)
    expect(readShopFulfillmentPreference("site-1")).toBeNull()
  })

  it("remains usable when storage is blocked", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked") })
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked") })
    expect(readShopFulfillmentPreference("site-1")).toBeNull()
    const { result } = renderHook(() => useCheckout())
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    act(() => result.current.setFulfillmentByUser("pickup"))
    expect(result.current.fulfillment).toBe("pickup")
    expect(result.current.userChoseFulfillmentRef.current).toBe(true)
  })

  it.each<CheckoutFulfillmentMethod>(["pickup", "ship", "dine_in"])("retains an explicit %s across product navigation and checkout remounts", async (method) => {
    const shop = renderHook(() => useCheckout())
    await waitFor(() => expect(shop.result.current.isPreferenceLoaded).toBe(true))
    act(() => shop.result.current.setFulfillmentByUser(method))
    expect(readShopFulfillmentPreference("site-1")).toBe(method)
    shop.unmount()
    const checkout = renderHook(() => useCheckout({ nearby: true }))
    await waitFor(() => expect(checkout.result.current.isPreferenceLoaded).toBe(true))
    expect(checkout.result.current.fulfillment).toBe(method)
    expect(checkout.result.current.isPreferenceLoaded).toBe(true)
  })

  it("does not replace shipping with pickup when location arrives late", async () => {
    writeShopFulfillmentPreference("site-1", "ship")
    const { result, rerender } = renderHook(({ nearby }) => useCheckout({ nearby }), { initialProps: { nearby: false } })
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    rerender({ nearby: true })
    expect(result.current.fulfillment).toBe("ship")
  })

  it("falls back for incompatible items without overwriting the buyer's preference", async () => {
    writeShopFulfillmentPreference("site-1", "dine_in")
    const { result } = renderHook(() => useCheckout({ allowedOptions: ["ship"] }))
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("ship")
    expect(readShopFulfillmentPreference("site-1")).toBe("dine_in")
  })

  it("keeps automatic nearby defaults when no explicit preference exists", async () => {
    const { result } = renderHook(() => useCheckout({ nearby: true }))
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("pickup")
    expect(result.current.paymentMethod).toBe("cash_on_pickup")
    expect(readShopFulfillmentPreference("site-1")).toBeNull()
  })

  it("does not apply shop preferences to marketplace checkout", async () => {
    writeShopFulfillmentPreference("site-1", "dine_in")
    const { result } = renderHook(() => useCheckout({ siteId: null }))
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("ship")
    act(() => result.current.setFulfillmentByUser("pickup"))
    expect(readShopFulfillmentPreference("site-1")).toBe("dine_in")
  })

  it("restores the correct scope when the shop changes", async () => {
    writeShopFulfillmentPreference("site-1", "pickup")
    writeShopFulfillmentPreference("site-2", "dine_in")
    const { result, rerender } = renderHook(({ siteId }) => useCheckout({ siteId }), { initialProps: { siteId: "site-1" } })
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("pickup")
    rerender({ siteId: "site-2" })
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("dine_in")
    act(() => result.current.setFulfillmentByUser("ship"))
    expect(readShopFulfillmentPreference("site-1")).toBe("pickup")
    expect(readShopFulfillmentPreference("site-2")).toBe("ship")
    rerender({ siteId: "site-3" })
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("ship")
    expect(result.current.userChoseFulfillmentRef.current).toBe(false)
  })

  it("waits for checkout restoration before applying defaults", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useCheckout({ enabled, nearby: true }), { initialProps: { enabled: false } })
    expect(result.current.fulfillment).toBe("ship")
    expect(result.current.paymentMethod).toBe("")
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    rerender({ enabled: true })
    expect(result.current.fulfillment).toBe("pickup")
  })

  it("restores safely under StrictMode without saving automatic defaults", async () => {
    writeShopFulfillmentPreference("site-1", "dine_in")
    const { result } = renderHook(() => useCheckout({ nearby: true }), { wrapper: StrictMode })
    await waitFor(() => expect(result.current.isPreferenceLoaded).toBe(true))
    expect(result.current.fulfillment).toBe("dine_in")
    expect(readShopFulfillmentPreference("site-1")).toBe("dine_in")
  })

  it("never lets pending restoration overwrite an immediate user selection", async () => {
    writeShopFulfillmentPreference("site-1", "pickup")
    const { result } = renderHook(() => useCheckout())
    act(() => result.current.setFulfillmentByUser("dine_in"))
    await act(async () => { await Promise.resolve() })
    expect(result.current.fulfillment).toBe("dine_in")
    expect(readShopFulfillmentPreference("site-1")).toBe("dine_in")
  })
})