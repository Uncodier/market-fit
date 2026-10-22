import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { SelfServiceProvider, useSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"
import { readSelfServiceCart, selfServiceCartKey } from "@/app/shop/[siteSlug]/self-service/self-service-storage"
import type { ShopSelfServiceContext } from "@/app/shop/[siteSlug]/shop-route-context"
import { shopItem } from "./catalog-fixture"

const context = { site: { id: "site", name: "Coffee Shop", settings: {} }, location: { id: "branch-one", site_id: "site", name: "Downtown" }, fulfillmentOptions: ["pickup", "dine_in"] } as ShopSelfServiceContext
const product = { ...shopItem("coffee", "Coffee"), target_sale_price: 10 }
const modifier = { groupId: "milk", catalogItemId: "oat", name: "Oat milk", cartQty: 1, cartPrice: 2 }
const wrapper = ({ children }: { children: ReactNode }) => <SelfServiceProvider context={context}>{children}</SelfServiceProvider>

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

it("keeps signed identity in memory, stores only location-scoped cart and retains modifiers", async () => {
  const { result } = renderHook(useSelfService, { wrapper })
  await act(async () => {})
  act(() => {
    result.current.setIdentity({ code: "mf:buyer:payload.signature", name: "Alex" })
    result.current.addItem(product, 2, [modifier])
  })
  expect(result.current.identity?.name).toBe("Alex")
  expect(readSelfServiceCart("branch-one")).toEqual([expect.objectContaining({ cartQty: 2, modifiers: [modifier], lineKey: "coffee|milk:oat:1" })])
  expect(readSelfServiceCart("branch-two")).toEqual([])
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(1)
  expect(sessionStorage.getItem(selfServiceCartKey("branch-one"))).not.toContain("Alex")
  expect(sessionStorage.getItem(selfServiceCartKey("branch-one"))).not.toContain("mf:buyer")
})

it("merges identical modifier configurations but preserves distinct cart lines", async () => {
  const { result } = renderHook(useSelfService, { wrapper })
  await act(async () => {})
  act(() => {
    result.current.addItem(product, 1, [modifier])
    result.current.addItem(product, 2, [modifier])
    result.current.addItem(product)
  })
  expect(result.current.cart.map((line) => line.cartQty)).toEqual([3, 1])
  act(() => result.current.updateQty("coffee|milk:oat:1", -3))
  expect(result.current.cart).toEqual([expect.objectContaining({ lineKey: "coffee|", cartQty: 1 })])
})

it("clears identity, cart and promotion when starting a new order", async () => {
  const { result } = renderHook(useSelfService, { wrapper })
  await act(async () => {})
  act(() => {
    result.current.addItem(product)
    result.current.setIdentity({ code: "mf:buyer:payload.signature", name: "Alex" })
    result.current.setPromotion({ id: "coupon", code: "SAVE" })
    result.current.setFulfillment("dine_in")
  })
  act(() => result.current.startNewOrder())
  expect(result.current.cart).toEqual([])
  expect(result.current.identity).toBeNull()
  expect(result.current.promotion).toBeNull()
  expect(result.current.fulfillment).toBe("pickup")
  expect(result.current.orderVersion).toBe(1)
  expect(sessionStorage.length).toBe(0)
})

it("rejects foreign, digital, shipping-only and location-incompatible items", async () => {
  const { result } = renderHook(useSelfService, { wrapper })
  await act(async () => {})
  act(() => {
    result.current.addItem({ ...product, site_id: "other" })
    result.current.addItem({ ...product, kind: "digital_asset" })
    result.current.addItem({ ...product, metadata: { delivery_options: ["ship"] } })
    result.current.addItem({ ...product, metadata: { pickup_location_ids: ["branch-two"] } })
  })
  expect(result.current.cart).toEqual([])
})

it("does not restore buyer identity after remounting a kiosk session", async () => {
  const first = renderHook(useSelfService, { wrapper })
  await act(async () => {})
  act(() => { first.result.current.addItem(product); first.result.current.setIdentity({ code: "mf:buyer:a.b", name: "Alex" }) })
  first.unmount()
  const next = renderHook(useSelfService, { wrapper })
  await act(async () => {})
  expect(next.result.current.cart).toHaveLength(1)
  expect(next.result.current.identity).toBeNull()
})