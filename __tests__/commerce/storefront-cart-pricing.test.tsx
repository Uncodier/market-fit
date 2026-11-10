import { act, renderHook, waitFor } from "@testing-library/react"
import { useState } from "react"
import { useStorefrontCartPricing } from "@/app/components/commerce/use-storefront-cart-pricing"
import { getStorefrontCartPrices } from "@/app/commerce/storefront-cart-prices"

let user: { id: string; email: string } | null = null
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user, isLoading: false }) }))
jest.mock("@/app/commerce/storefront-cart-prices", () => ({ getStorefrontCartPrices: jest.fn() }))
const line = { id: "host", site_id: "seller", currency: "USD", cartPrice: 99, cartQty: 2,
  modifiers: [{ groupId: "group", catalogItemId: "extra", name: "Extra", cartQty: 3, cartPrice: 8 }] }
const response = (price: number) => ({ items: [
  { id: "host", site_id: "seller", price, currency: "EUR", dynamic: false },
  { id: "extra", site_id: "seller", price: 10, currency: "USD", dynamic: false },
], rates: { EUR: 0.5 } })
function useCart() {
  const [cart, setCart] = useState([line])
  return { cart, setCart, ...useStorefrontCartPricing(cart, setCart, "shop") }
}
beforeEach(() => { user = null; jest.clearAllMocks() })

it("reprices restored cart and modifiers, preserves quantities, avoids reads on quantity edits", async () => {
  jest.mocked(getStorefrontCartPrices).mockResolvedValue(response(20))
  const { result } = renderHook(useCart)
  expect(result.current.pricingPending).toBe(true)
  await waitFor(() => expect(result.current.pricingPending).toBe(false))
  expect(result.current.cart[0]).toMatchObject({ cartPrice: 20, currency: "EUR", cartQty: 2,
    modifiers: [{ cartPrice: 5, cartQty: 3 }] })
  act(() => result.current.setCart(previous => previous.map(item => ({ ...item, cartQty: 7 }))))
  expect(getStorefrontCartPrices).toHaveBeenCalledTimes(1)
})

it("rejects late responses after customer switches and reprices again on logout", async () => {
  let resolveGuest!: (value: ReturnType<typeof response>) => void
  jest.mocked(getStorefrontCartPrices).mockReturnValueOnce(new Promise(resolve => { resolveGuest = resolve }))
  const { result, rerender } = renderHook(useCart)
  user = { id: "buyer", email: "buyer@example.com" }
  jest.mocked(getStorefrontCartPrices).mockResolvedValue(response(12))
  rerender()
  await waitFor(() => expect(result.current.cart[0].cartPrice).toBe(12))
  await act(async () => resolveGuest(response(90)))
  expect(result.current.cart[0].cartPrice).toBe(12)
  user = null
  jest.mocked(getStorefrontCartPrices).mockResolvedValue(response(30))
  rerender()
  expect(result.current.pricingPending).toBe(true)
  await waitFor(() => expect(result.current.cart[0].cartPrice).toBe(30))
})

it("blocks checkout rather than mixing currencies when FX is unavailable", async () => {
  jest.mocked(getStorefrontCartPrices).mockResolvedValue({ ...response(20), rates: {} })
  const { result } = renderHook(useCart)
  await waitFor(() => expect(result.current.pricingError).toMatch(/Unable to refresh/))
  expect(result.current.pricingPending).toBe(true)
  expect(result.current.cart[0].cartPrice).toBe(99)
})

it("keeps dynamic quotes and never applies a catalog price to quotation checkout", async () => {
  jest.mocked(getStorefrontCartPrices).mockResolvedValue({ items: [{ id: "host", site_id: "seller",
    price: 1, currency: "USD", dynamic: true }], rates: {} })
  const { result } = renderHook(() => {
    const [cart, setCart] = useState([{ ...line, modifiers: [] }])
    return { cart, ...useStorefrontCartPricing(cart, setCart, "marketplace") }
  })
  await waitFor(() => expect(result.current.pricingPending).toBe(false))
  expect(result.current.cart[0].cartPrice).toBe(99)
  jest.mocked(getStorefrontCartPrices).mockClear()
  renderHook(() => {
    const [cart, setCart] = useState([line])
    return useStorefrontCartPricing(cart, setCart, "shop", false)
  })
  expect(getStorefrontCartPrices).not.toHaveBeenCalled()
})

it("reports all affected line keys for missing hosts and modifiers, not healthy configurations", async () => {
  jest.mocked(getStorefrontCartPrices).mockResolvedValue({ items: [response(20).items[0]], rates: {} })
  const { result } = renderHook(() => {
    const [cart, setCart] = useState([
      { ...line, lineKey: "host-with-extra" },
      { ...line, lineKey: "host-plain", modifiers: [] },
      { ...line, id: "removed", lineKey: "removed-configuration" },
    ])
    return { cart, setCart, ...useStorefrontCartPricing(cart, setCart, "shop") }
  })
  await waitFor(() => expect(result.current.pricingError).toMatch(/unavailable/))
  expect(result.current.pricingAffectedLineIds).toEqual(["host-with-extra", "removed-configuration"])
  expect(result.current.pricingUnavailableItemIds).toEqual(["extra", "removed"])
  act(() => result.current.setCart(previous => previous.filter(item => item.lineKey === "host-plain")))
  await waitFor(() => expect(result.current.pricingPending).toBe(false))
  expect(result.current.pricingError).toBeUndefined()
  expect(result.current.cart[0].cartPrice).toBe(20)
  expect(getStorefrontCartPrices).toHaveBeenCalledTimes(2)
})

it("retries transient errors without marking products unavailable or reading on quantity edits", async () => {
  jest.mocked(getStorefrontCartPrices).mockRejectedValueOnce(new Error("Network error"))
  const { result } = renderHook(useCart)
  await waitFor(() => expect(result.current.pricingError).toMatch(/retry/))
  expect(result.current.pricingAffectedLineIds).toEqual([])
  expect(result.current.pricingUnavailableItemIds).toEqual([])
  act(() => result.current.setCart(previous => previous.map(item => ({ ...item, cartQty: 5 }))))
  expect(getStorefrontCartPrices).toHaveBeenCalledTimes(1)
  jest.mocked(getStorefrontCartPrices).mockResolvedValue(response(25))
  act(() => result.current.retryPricing())
  expect(result.current.pricingPending).toBe(true)
  await waitFor(() => expect(result.current.pricingPending).toBe(false))
  expect(result.current.pricingError).toBeUndefined()
  expect(result.current.cart[0]).toMatchObject({ cartPrice: 25, cartQty: 5 })
})

it("clears recovery when every unavailable item is removed without another read", async () => {
  jest.mocked(getStorefrontCartPrices).mockResolvedValue({ items: [], rates: {} })
  const { result } = renderHook(useCart)
  await waitFor(() => expect(result.current.pricingAffectedLineIds).toEqual(["host"]))
  act(() => result.current.setCart([]))
  expect(result.current.pricingPending).toBe(false)
  expect(result.current.pricingError).toBeUndefined()
  expect(result.current.pricingAffectedLineIds).toEqual([])
  expect(getStorefrontCartPrices).toHaveBeenCalledTimes(1)
})

it("does not let a late rejection overwrite a successful retry", async () => {
  let reject!: (error: Error) => void
  jest.mocked(getStorefrontCartPrices).mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
  const { result } = renderHook(useCart)
  jest.mocked(getStorefrontCartPrices).mockResolvedValue(response(20))
  act(() => result.current.retryPricing())
  await waitFor(() => expect(result.current.pricingPending).toBe(false))
  await act(async () => reject(new Error("Late network error")))
  expect(result.current.pricingError).toBeUndefined()
  expect(result.current.cart[0].cartPrice).toBe(20)
})