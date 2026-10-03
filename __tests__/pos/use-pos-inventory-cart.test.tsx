import { act, renderHook } from "@testing-library/react"
import { useState } from "react"
import { toast } from "sonner"
import { usePosInventoryCart } from "@/app/pos/hooks/use-pos-inventory-cart"
import type { PosCartItem } from "@/app/pos/cart-types"
import type { CatalogItem } from "@/app/types"
import type { PosInventorySnapshot } from "@/app/pos/inventory-availability"

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn() } }))

const item = {
  id: "sku", name: "Product", status: "active", availability_mode: "inventory", track_inventory: true,
} as CatalogItem
const inventorySnapshot: PosInventorySnapshot = {
  policy: "block", levels: [{ catalog_item_id: "sku", location_id: "a", quantity: 2 }],
}
function useHarness(props: { locationId: string; inventory?: PosInventorySnapshot }) {
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [, setSelectedCartItemId] = useState<string | null>(null)
  return usePosInventoryCart({
    cart, setCart, setSelectedCartItemId, resolvePrice: () => 10,
    catalogItems: [item], inventorySnapshot: props.inventory || inventorySnapshot,
    originLocationId: props.locationId,
  })
}

describe("inventory-guarded cart edits", () => {
  beforeEach(() => jest.clearAllMocks())

  it("blocks rapid repeated additions, plus and numpad edits beyond stock", () => {
    const { result } = renderHook(() => useHarness({ locationId: "a" }))
    act(() => {
      result.current.addItemToCart(item)
      result.current.addItemToCart(item)
      result.current.addItemToCart(item)
    })
    expect(result.current.displayCart[0].cartQty).toBe(2)
    const key = result.current.displayCart[0].lineKey!
    act(() => result.current.updateQty(key, 1))
    act(() => result.current.setItemQty(key, 9))
    expect(result.current.displayCart[0].cartQty).toBe(2)
    expect(result.current.displayCart[0].inventoryCanIncrease).toBe(false)
    expect(toast.error).toHaveBeenCalledTimes(3)
  })

  it("revalidates on location changes and allows reducing an invalid cart", () => {
    const { result, rerender } = renderHook(useHarness, { initialProps: { locationId: "a" } })
    act(() => result.current.addItemToCart(item))
    rerender({ locationId: "missing" })
    expect(result.current.validateInventory()).toBe(false)
    expect(result.current.displayCart[0].inventoryMessage).toBeTruthy()
    act(() => result.current.updateQty(result.current.displayCart[0].lineKey!, -1))
    expect(result.current.displayCart).toEqual([])
  })

  it("checks the latest location when an earlier asynchronous picker finishes", () => {
    const { result, rerender } = renderHook(useHarness, { initialProps: { locationId: "a" } })
    const delayedAdd = result.current.addItemToCart
    rerender({ locationId: "missing" })
    act(() => delayedAdd(item))
    expect(result.current.displayCart).toEqual([])
    expect(toast.error).toHaveBeenCalled()
  })

  it.each(["allow", "warn"] as const)("marks only unavailable units as backorder under %s", (policy) => {
    const { result } = renderHook(() => useHarness({ locationId: "a", inventory: { ...inventorySnapshot, policy } }))
    act(() => result.current.addItemToCart(item, { cartQty: 3 }))
    expect(result.current.displayCart[0]).toMatchObject({ cartQty: 3, backorderQty: 1 })
    expect(result.current.validateInventory()).toBe(true)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })
})