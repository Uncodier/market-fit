import { act, renderHook } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { CatalogItem } from "@/app/types"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { cartLineKey } from "@/app/commerce/cart-modifiers"
import { getDeviceOrders } from "@/app/commerce/device-order-storage"
import { readPendingStorefrontPromo } from "@/app/components/commerce/storefront-pending-promo"
import { useShopCart } from "@/app/shop/[siteSlug]/useShopCart"

jest.mock("sonner", () => ({ toast: { success: jest.fn() } }))
jest.mock("@/app/commerce/cart-storage", () => ({ clearCart: jest.fn(), getCartItems: jest.fn(), setCartItems: jest.fn() }))
jest.mock("@/app/commerce/device-order-storage", () => ({ getDeviceOrders: jest.fn() }))
jest.mock("@/app/components/commerce/storefront-pending-promo", () => ({ readPendingStorefrontPromo: jest.fn() }))

const item: CatalogItem = {
  id: "product", name: "Product", site_id: "site", kind: "product", status: "active",
  track_inventory: false, availability_mode: "always", availability_status: "available",
  sort_order: 0, is_pos_available: true, is_recurring: false, is_reservation: false,
  target_sale_price: 10, created_at: "2026-10-16", updated_at: "2026-10-16",
}
const push = jest.fn()
const options = {
  siteId: "site", siteSlug: "my-shop", currency: "USD", ownedAccessMap: new Map<string, boolean>(),
  orderSuccess: false, trackEvent: jest.fn(), setPromotionCode: jest.fn(), setPromotionId: jest.fn(),
}

async function renderCart() {
  const hook = renderHook(() => useShopCart(options))
  await act(async () => { await Promise.resolve() })
  return hook
}

beforeEach(() => {
  jest.clearAllMocks()
  window.history.replaceState({}, "", "/shop/my-shop")
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  jest.mocked(getCartItems).mockReturnValue([])
  jest.mocked(getDeviceOrders).mockReturnValue([])
  jest.mocked(readPendingStorefrontPromo).mockReturnValue(null)
})

it.each<{ name: string; fields: Partial<CatalogItem> }>([
  { name: "listing variant flag", fields: { _shop: { hasVariants: true } } },
  { name: "legacy child SKUs", fields: { _shop: { children: [{ ...item, id: "child" }] } } },
  { name: "variant axes", fields: { metadata: { variant_axes: [{ id: "size", kind: "custom", values: [{ id: "small", label: "Small" }] }] } } },
  { name: "required modifiers", fields: { _shop: { hasRequiredModifiers: true } } },
  { name: "required modifiers before booking", fields: { is_reservation: true, _shop: { hasRequiredModifiers: true } } },
  { name: "dynamic pricing", fields: { is_dynamic_price: true } },
])("opens the product ID for $name without changing the cart", async ({ fields }) => {
  const { result } = await renderCart()
  jest.mocked(setCartItems).mockClear()
  act(() => result.current.addToCart({ ...item, ...fields }))
  expect(push).toHaveBeenCalledWith("/shop/my-shop/product")
  expect(result.current.cart).toEqual([])
  expect(result.current.isCartOpen).toBe(false)
  expect(setCartItems).not.toHaveBeenCalled()
  expect(options.trackEvent).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it.each([undefined, false])("keeps quick add for simple or optional-only products (flag=%s)", async (hasRequiredModifiers) => {
  const { result } = await renderCart()
  act(() => result.current.addToCart({ ...item, _shop: { hasRequiredModifiers } }))
  act(() => result.current.addToCart(item))
  expect(push).not.toHaveBeenCalled()
  expect(result.current.cart).toEqual([expect.objectContaining({ id: item.id, cartQty: 2, cartPrice: 10 })])
  expect(result.current.isCartOpen).toBe(true)
  expect(options.trackEvent).toHaveBeenCalledWith("add_to_cart", expect.objectContaining({ item_id: item.id }))
  expect(setCartItems).toHaveBeenLastCalledWith("cart", "shop", "site", result.current.cart)
})

it("keeps booking navigation for reservations without required configuration", async () => {
  const { result } = await renderCart()
  act(() => result.current.addToCart({ ...item, is_reservation: true }))
  expect(push).toHaveBeenCalledWith("/shop/my-shop/product/book")
  expect(result.current.cart).toEqual([])
})

it("uses current listing flags after catalog updates and leaves configured lines intact", async () => {
  const configured = { ...item, cartQty: 1, cartPrice: 10 }
  jest.mocked(getCartItems).mockReturnValue([configured])
  const { result, rerender } = renderHook(useShopCart, { initialProps: options })
  await act(async () => { await Promise.resolve() })
  rerender({ ...options, currency: "EUR" })
  act(() => result.current.addToCart({ ...item, _shop: { hasRequiredModifiers: true } }))
  expect(result.current.cart).toEqual([configured])
  act(() => result.current.addToCart(item))
  expect(options.trackEvent).toHaveBeenCalledWith("add_to_cart", expect.objectContaining({ currency: "EUR" }))
})

it("restores site-scoped cart data and updates quantities by line identity", async () => {
  const stored = { ...item, cartQty: 2, cartPrice: 10 }
  jest.mocked(getCartItems).mockReturnValue([stored, { ...stored, id: "foreign", site_id: "other-site" }])
  const { result } = await renderCart()
  expect(result.current.cart).toEqual([stored])
  act(() => result.current.updateQty(cartLineKey(stored), -2))
  expect(result.current.cart).toEqual([])
})

it("clears the cart on checkout return", async () => {
  window.history.replaceState({}, "", "/shop/my-shop?ordered=1")
  const { result } = await renderCart()
  expect(clearCart).toHaveBeenCalledWith("cart", "shop", "site")
  expect(result.current.cart).toEqual([])
  expect(window.location.hash).toBe("#your-orders")
})

it("restores pending promotions and opens the cart", async () => {
  jest.mocked(readPendingStorefrontPromo).mockReturnValue({ surface: "shop", siteId: "site", promotionId: "promo", code: "SAVE" })
  const { result } = await renderCart()
  expect(options.setPromotionCode).toHaveBeenCalledWith("SAVE")
  expect(options.setPromotionId).toHaveBeenCalledWith("promo")
  expect(result.current.isCartOpen).toBe(true)
})

it("does not overwrite another site's stored cart while hydrating a site change", async () => {
  const first = { ...item, cartQty: 1, cartPrice: 10 }
  const second = { ...first, id: "second", site_id: "second-site" }
  jest.mocked(getCartItems).mockImplementation((_key, _source, siteId) => siteId === "site" ? [first] : [second])
  const { result, rerender } = renderHook(useShopCart, { initialProps: options })
  await act(async () => { await Promise.resolve() })
  jest.mocked(setCartItems).mockClear()
  rerender({ ...options, siteId: "second-site", siteSlug: "second-shop" })
  await act(async () => { await Promise.resolve() })
  expect(result.current.cart).toEqual([second])
  expect(setCartItems).toHaveBeenCalledTimes(1)
  expect(setCartItems).toHaveBeenCalledWith("cart", "shop", "second-site", [second])
})