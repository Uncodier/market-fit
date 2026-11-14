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
function useHarness(props: { locationId: string; inventory?: PosInventorySnapshot; initialCart?: PosCartItem[] }) {
  const [cart, setCart] = useState<PosCartItem[]>(props.initialCart || [])
  const [, setSelectedCartItemId] = useState<string | null>(null)
  return usePosInventoryCart({
    cart, setCart, setSelectedCartItemId, resolvePrice: () => 10,
    catalogItems: [item], inventorySnapshot: props.inventory || inventorySnapshot,
    originLocationId: props.locationId,
  })
}

describe("inventory-guarded cart edits", () => {
  beforeEach(() => jest.clearAllMocks())

  it("prompts for rapid repeated additions, plus and numpad edits beyond stock", () => {
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
    expect(result.current.shortage).toMatchObject({ item: { id: "sku" }, quantity: 7 })
    expect(toast.error).not.toHaveBeenCalled()
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
    expect(result.current.shortage?.item.id).toBe("sku")
  })

  it.each(["allow", "warn"] as const)("asks before adding unavailable units under %s", (policy) => {
    const { result } = renderHook(() => useHarness({ locationId: "a", inventory: { ...inventorySnapshot, policy } }))
    act(() => result.current.addItemToCart(item, { cartQty: 3 }))
    expect(result.current.displayCart).toEqual([])
    expect(result.current.shortage).toMatchObject({ quantity: 1 })
    act(() => result.current.completeShortage())
    expect(result.current.displayCart[0]).toMatchObject({ cartQty: 3, backorderQty: 0, completedWithoutStock: true })
    expect(result.current.validateInventory()).toBe(true)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("completes only a new delta and asks again for subsequent increases", () => {
    const { result } = renderHook(() => useHarness({ locationId: "a" }))
    act(() => result.current.addItemToCart(item, { cartQty: 2 }))
    const key = result.current.displayCart[0].lineKey!
    act(() => result.current.setItemQty(key, 3))
    act(() => result.current.completeShortage())
    expect(result.current.displayCart.map((line) => [line.cartQty, !!line.completedWithoutStock])).toEqual([[2, false], [1, true]])
    const completedKey = result.current.displayCart[1].lineKey!
    act(() => result.current.updateQty(completedKey, 1))
    expect(result.current.shortage).not.toBeNull()
    act(() => result.current.dismissShortage())
    expect(result.current.displayCart[1].cartQty).toBe(1)
  })

  it("rejects a stale confirmation after the location changes", () => {
    const { result, rerender } = renderHook(useHarness, { initialProps: { locationId: "missing" } })
    act(() => result.current.addItemToCart(item))
    rerender({ locationId: "a" })
    act(() => result.current.completeShortage())
    expect(result.current.displayCart).toEqual([])
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("changed"))
  })

  it("keeps persisted completed units separate when increasing a restored line with stock", () => {
    const original = { ...item, cartQty: 2, cartPrice: 10, lineKey: "original",
      saleOrderItemId: "persisted", inventoryCompletedQty: 2 } as PosCartItem
    const { result } = renderHook(() => useHarness({ locationId: "a", initialCart: [original] }))
    act(() => result.current.updateQty("original", 1))
    expect(result.current.displayCart).toHaveLength(2)
    expect(result.current.displayCart[0]).toMatchObject({ cartQty: 2, saleOrderItemId: "persisted", inventoryCompletedQty: 2 })
    expect(result.current.displayCart[1]).toMatchObject({ cartQty: 1, saleOrderItemId: undefined, inventoryCompletedQty: undefined })
    expect(result.current.validateInventory()).toBe(true)
  })
})