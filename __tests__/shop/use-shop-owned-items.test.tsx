import { act, renderHook, waitFor } from "@testing-library/react"
import type { CatalogItem } from "@/app/types"
import { getShopItemsByIds, getShopUserOwnedItems } from "@/app/shop/[siteSlug]/actions"
import { useShopOwnedItems } from "@/app/shop/[siteSlug]/useShopOwnedItems"

jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopItemsByIds: jest.fn(), getShopUserOwnedItems: jest.fn() }))

const user = { id: "buyer" }
const access = [{ catalogItemId: "pass", canBook: true }]
const items = [{ id: "pass", site_id: "site", name: "Pass" }] as CatalogItem[]

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getShopUserOwnedItems).mockResolvedValue(access)
  jest.mocked(getShopItemsByIds).mockResolvedValue({ data: items, error: undefined })
})

it("loads per-buyer owned items after authentication", async () => {
  const { result } = renderHook(() => useShopOwnedItems("site", user, [], []))
  await waitFor(() => expect(result.current.ownedItemsData).toEqual(items))
  expect(result.current.ownedAccessMap.get("pass")).toBe(true)
  expect(getShopUserOwnedItems).toHaveBeenCalledWith("site")
  expect(getShopItemsByIds).toHaveBeenCalledWith("site", ["pass"])
})

it("does not request buyer data for guests and clears initial ownership", () => {
  const { result } = renderHook(() => useShopOwnedItems("site", null, access, items))
  expect(result.current.ownedItemsData).toEqual([])
  expect(result.current.ownedAccessMap.size).toBe(0)
  expect(getShopUserOwnedItems).not.toHaveBeenCalled()
})

it("does not request item details when the buyer owns nothing", async () => {
  jest.mocked(getShopUserOwnedItems).mockResolvedValue([])
  const { result } = renderHook(() => useShopOwnedItems("site", user, access, items))
  await waitFor(() => expect(result.current.ownedItemsData).toEqual([]))
  expect(getShopItemsByIds).not.toHaveBeenCalled()
})

it("ignores stale ownership after logout", async () => {
  let resolve!: (value: typeof access) => void
  jest.mocked(getShopUserOwnedItems).mockReturnValue(new Promise((done) => { resolve = done }))
  const { result, rerender } = renderHook(({ buyer }) => useShopOwnedItems("site", buyer, [], []), {
    initialProps: { buyer: user as typeof user | null },
  })
  rerender({ buyer: null })
  await act(async () => { resolve(access) })
  expect(result.current.ownedAccessMap.size).toBe(0)
  expect(result.current.ownedItemsData).toEqual([])
  expect(getShopItemsByIds).not.toHaveBeenCalled()
})

it("clears ownership when the buyer read fails", async () => {
  jest.mocked(getShopUserOwnedItems).mockRejectedValue(new Error("Unavailable"))
  const { result } = renderHook(() => useShopOwnedItems("site", user, access, items))
  await waitFor(() => expect(result.current.ownedItemsData).toEqual([]))
  expect(result.current.ownedAccessMap.size).toBe(0)
})