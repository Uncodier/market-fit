import { act, renderHook, waitFor } from "@testing-library/react"
import { getShopCatalog } from "@/app/shop/[siteSlug]/actions"
import { useShopCatalog } from "@/app/shop/[siteSlug]/useShopCatalog"
import { buildShopCategorySections } from "@/app/shop/[siteSlug]/shop-catalog-shared"
import { shopItem } from "./catalog-fixture"

jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopCatalog: jest.fn() }))

const coffee = shopItem("coffee", "Coffee")
const tea = shopItem("tea", "Tea", 1)
const initial = [coffee]
const offsets = [{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 1, count: 1 }]
const response = (data = [tea], count = data.length) => ({ data, count, totalPages: 1, page: 1, pageSize: 100, offset: 0 })
type LoadResult = boolean | undefined

beforeEach(() => { jest.clearAllMocks(); jest.mocked(getShopCatalog).mockReset() })

it("keeps loaded cards while jumping and does not replace the feed or schedule scroll corrections", async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  jest.mocked(getShopCatalog).mockReturnValue(new Promise((done) => { resolve = done }))
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", offsets))

  let loading!: Promise<LoadResult>
  act(() => { loading = result.current.jumpToCategory(1, "Tea", 1) })
  expect(result.current.catalogItems).toEqual(initial)
  expect(result.current.pendingScrollCategory).toBe("Tea")
  expect(result.current.isJumping).toBe(true)

  await act(async () => { resolve(response()); expect(await loading).toBe(true) })
  expect(result.current.catalogItems).toEqual([coffee, tea])
  expect(result.current.isJumping).toBe(false)
  expect(result.current.hasMoreBelow).toBe(false)
  expect(getShopCatalog).toHaveBeenCalledTimes(1)
})

it("loads a nearby category without initiating navigation", async () => {
  jest.mocked(getShopCatalog).mockResolvedValue(response())
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", offsets))
  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 1, false)).toBe(true) })
  expect(result.current.catalogItems).toEqual([coffee, tea])
  expect(result.current.pendingScrollCategory).toBeNull()
  expect(result.current.isJumping).toBe(false)
  expect(result.current.isLoadingMore).toBe(false)
})

it("deduplicates overlapping category pages and restores item order", async () => {
  const secondCoffee = shopItem("coffee-2", "Coffee", 1)
  jest.mocked(getShopCatalog).mockResolvedValue(response([secondCoffee, coffee]))
  const { result } = renderHook(() => useShopCatalog("site", initial, 3, "", offsets))
  await act(async () => { await result.current.jumpToCategory(0, "Coffee", 2) })
  expect(result.current.catalogItems).toEqual([coffee, secondCoffee])
})

it("paginates categories when the server caps a page below the requested size", async () => {
  const secondTea = shopItem("tea-2", "Tea", 2)
  jest.mocked(getShopCatalog).mockResolvedValueOnce(response([tea], 2)).mockResolvedValueOnce(response([secondTea], 2))
  const { result } = renderHook(() => useShopCatalog("site", initial, 3, "", offsets))
  await act(async () => { await result.current.jumpToCategory(1, "Tea", 2) })
  expect(result.current.catalogItems).toEqual([coffee, tea, secondTea])
  expect(getShopCatalog).toHaveBeenLastCalledWith("site", { offset: 1, pageSize: 100, search: "", category: "Tea" })
})

it("ignores a stale category response after a newer selection", async () => {
  let resolveOld!: (value: ReturnType<typeof response>) => void
  jest.mocked(getShopCatalog).mockReturnValueOnce(new Promise((done) => { resolveOld = done })).mockResolvedValueOnce(response())
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", offsets))
  let oldLoading!: Promise<LoadResult>
  act(() => { oldLoading = result.current.jumpToCategory(0, "Coffee", 1) })
  await act(async () => { await result.current.jumpToCategory(1, "Tea", 1) })
  await act(async () => { resolveOld(response([shopItem("stale", "Coffee")])); expect(await oldLoading).toBeUndefined() })
  expect(result.current.catalogItems).toEqual([coffee, tea])
  expect(result.current.pendingScrollCategory).toBe("Tea")
})

it("preserves existing items on a category failure and permits a retry", async () => {
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {})
  jest.mocked(getShopCatalog).mockResolvedValueOnce({ ...response([], 0), data: [], error: "Database unavailable" }).mockResolvedValueOnce(response())
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", offsets))
  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 1)).toBe(false) })
  expect(result.current.catalogItems).toEqual(initial)
  expect(result.current.pendingScrollCategory).toBeNull()
  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 1)).toBe(true) })
  expect(result.current.catalogItems).toEqual([coffee, tea])
  errorLog.mockRestore()
})

it.each([2, 0])("reconciles stale count 3 to %i and retires archived cards and placeholders", async (count) => {
  const staleTea = shopItem("archived-tea", "Tea", 2)
  const secondTea = shopItem("tea-2", "Tea", 3)
  const loaded = [coffee, tea, staleTea]
  const staleOffsets = [{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 1, count: 3 }]
  jest.mocked(getShopCatalog).mockResolvedValue(response(count ? [tea, secondTea] : [], count))
  const { result } = renderHook(() => useShopCatalog("site", loaded, 4, "", staleOffsets))
  expect(buildShopCategorySections(loaded, result.current.categoryOffsets)[1].pendingCount).toBe(1)

  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 3, false)).toBe(true) })
  expect(result.current.catalogItems).toEqual(count ? [coffee, tea, secondTea] : [coffee])
  expect(result.current.categoryOffsets).toEqual([{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 1, count }])
  expect(result.current.totalCount).toBe(count + 1)
  expect(result.current.hasMoreBelow).toBe(false)
  const sections = buildShopCategorySections(result.current.catalogItems, result.current.categoryOffsets)
  expect(sections.every((section) => section.pendingCount === 0)).toBe(true)
  expect(sections.map((section) => section.name)).toEqual(count ? ["Coffee", "Tea"] : ["Coffee"])
})

it("uses the same authoritative reconciliation for loadMoreBelow category requests", async () => {
  const staleOffsets = [{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 1, count: 3 }]
  jest.mocked(getShopCatalog).mockResolvedValue(response([tea], 1))
  const { result } = renderHook(() => useShopCatalog("site", initial, 4, "", staleOffsets))
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(result.current.categoryOffsets[1].count).toBe(1)
  expect(result.current.totalCount).toBe(2)
  expect(result.current.hasMoreBelow).toBe(false)
})

it.each(["Coffee", "New category"])("paginates row 21 when metadata only counted 20 and discovers %s", async (categoryName) => {
  const loaded = Array.from({ length: 20 }, (_, index) => shopItem(`coffee-${index}`, "Coffee", index))
  const last = shopItem("row-21", categoryName, 20)
  const underestimated = [{ name: "Coffee", offset: 0, count: 20 }]
  jest.mocked(getShopCatalog).mockResolvedValue(response([last], 21))
  const { result } = renderHook(() => useShopCatalog("site", loaded, 21, "", underestimated))
  expect(result.current.hasMoreBelow).toBe(true)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(getShopCatalog).toHaveBeenCalledWith("site", { offset: 20, pageSize: 20, search: "" })
  expect(result.current.catalogItems).toEqual([...loaded, last])
  expect(result.current.categoryOffsets).toEqual(categoryName === "Coffee"
    ? [{ name: "Coffee", offset: 0, count: 21 }]
    : [{ name: "Coffee", offset: 0, count: 20 }, { name: categoryName, offset: 20, count: 1 }])
  expect(result.current.totalCount).toBe(21)
  expect(result.current.hasMoreBelow).toBe(false)
})

it("does not advance the contiguous global cursor when jumping past unknown products", async () => {
  const unseen = shopItem("unseen-middle", "Coffee", 1)
  const lateTea = shopItem("late-tea", "Tea", 50)
  const staleOffsets = [{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 50, count: 1 }]
  jest.mocked(getShopCatalog).mockResolvedValueOnce(response([lateTea], 1)).mockResolvedValueOnce(response([unseen, lateTea], 3))
  const { result } = renderHook(() => useShopCatalog("site", initial, 3, "", staleOffsets))
  await act(async () => { expect(await result.current.jumpToCategory(50, "Tea", 1)).toBe(true) })
  expect(result.current.totalCount).toBe(2)
  expect(result.current.hasMoreBelow).toBe(true)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(getShopCatalog).toHaveBeenLastCalledWith("site", { offset: 1, pageSize: 20, search: "" })
  expect(result.current.catalogItems).toEqual([coffee, lateTea, unseen])
  expect(result.current.categoryOffsets[0].count).toBe(2)
  expect(result.current.hasMoreBelow).toBe(false)
})

it("keeps paging by global cursor when total count exceeds all category counts after a jump", async () => {
  const secondCoffee = shopItem("coffee-2", "Coffee", 2)
  const thirdCoffee = shopItem("coffee-3", "Coffee", 3)
  const fourthCoffee = shopItem("coffee-4", "Coffee", 4)
  jest.mocked(getShopCatalog)
    .mockResolvedValueOnce(response([secondCoffee], 5))
    .mockResolvedValueOnce(response([tea], 1))
    .mockResolvedValueOnce(response([thirdCoffee, fourthCoffee, tea], 5))
  const staleOffsets = [{ name: "Coffee", offset: 0, count: 1 }]
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", staleOffsets))
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(result.current.totalCount).toBe(5)
  expect(result.current.categoryOffsets[0].count).toBe(2)
  expect(result.current.hasMoreBelow).toBe(true)
  await act(async () => { expect(await result.current.jumpToCategory(4, "Tea", 1)).toBe(true) })
  expect(result.current.totalCount).toBe(3)
  expect(result.current.hasMoreBelow).toBe(true)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(getShopCatalog).toHaveBeenLastCalledWith("site", { offset: 2, pageSize: 20, search: "" })
  expect(result.current.catalogItems).toEqual([coffee, tea, secondCoffee, thirdCoffee, fourthCoffee])
  expect(result.current.hasMoreBelow).toBe(false)
})

it.each(["empty", "duplicate", "error"])("rejects an incomplete %s category page without changing metadata and permits retry", async (failure) => {
  const secondTea = shopItem("tea-2", "Tea", 2)
  const staleOffsets = [{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 1, count: 2 }]
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {})
  const request = jest.mocked(getShopCatalog).mockResolvedValueOnce(response([tea], 2))
  if (failure === "error") request.mockResolvedValueOnce({ ...response([], 2), data: [], error: "Offline" })
  else request.mockResolvedValueOnce(response(failure === "duplicate" ? [tea] : [], 2))
  request.mockResolvedValueOnce(response([tea, secondTea], 2))
  const { result } = renderHook(() => useShopCatalog("site", initial, 3, "", staleOffsets))
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(false) })
  expect(result.current.catalogItems).toEqual(initial)
  expect(result.current.categoryOffsets).toEqual(staleOffsets)
  expect(result.current.totalCount).toBe(3)
  expect(result.current.isLoadingMore).toBe(false)
  expect(result.current.hasMoreBelow).toBe(true)
  expect(getShopCatalog).toHaveBeenCalledTimes(2)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(result.current.catalogItems).toEqual([coffee, tea, secondTea])
  errorLog.mockRestore()
})

it("returns false on global request failure without consuming the cursor and allows an explicit retry", async () => {
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {})
  jest.mocked(getShopCatalog).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(response([tea], 2))
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", []))
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(false) })
  expect(result.current.catalogItems).toEqual(initial)
  expect(result.current.totalCount).toBe(2)
  expect(result.current.hasMoreBelow).toBe(true)
  expect(getShopCatalog).toHaveBeenCalledTimes(1)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(getShopCatalog).toHaveBeenLastCalledWith("site", { offset: 1, pageSize: 20, search: "" })
  errorLog.mockRestore()
})

it("returns undefined for an in-flight load superseded by a category selection and blocks duplicate loads", async () => {
  let resolveOld!: (value: ReturnType<typeof response>) => void
  jest.mocked(getShopCatalog).mockReturnValueOnce(new Promise((done) => { resolveOld = done })).mockResolvedValueOnce(response())
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", []))
  let oldLoading!: Promise<LoadResult>
  act(() => { oldLoading = result.current.loadMoreBelow() })
  await act(async () => { expect(await result.current.loadMoreBelow()).toBeUndefined() })
  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 1)).toBe(true) })
  await act(async () => { resolveOld(response([shopItem("stale", "Tea")])); expect(await oldLoading).toBeUndefined() })
  expect(result.current.catalogItems).toEqual([coffee, tea])
})

it("returns undefined without applying a category response after unmount", async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  jest.mocked(getShopCatalog).mockReturnValue(new Promise((done) => { resolve = done }))
  const { result, unmount } = renderHook(() => useShopCatalog("site", initial, 2, "", offsets))
  let loading!: Promise<LoadResult>
  act(() => { loading = result.current.jumpToCategory(1, "Tea", 1) })
  unmount()
  resolve(response())
  expect(await loading).toBeUndefined()
})

it("uses loaded initial names and counts as a lower bound for stale metadata", () => {
  const loaded = [coffee, shopItem("coffee-2", "Coffee", 1), tea]
  const staleOffsets = [{ name: "Coffee", offset: 0, count: 1 }]
  const { result } = renderHook(() => useShopCatalog("site", loaded, 3, "", staleOffsets))
  expect(result.current.categoryOffsets).toEqual([
    { name: "Coffee", offset: 0, count: 2 }, { name: "Tea", offset: 2, count: 1 },
  ])
  expect(result.current.hasMoreBelow).toBe(false)
})

it("accepts an authoritative empty global page and stops stale-count pagination", async () => {
  jest.mocked(getShopCatalog).mockResolvedValue(response([], 1))
  const { result } = renderHook(() => useShopCatalog("site", initial, 21, "", [{ name: "Coffee", offset: 0, count: 1 }]))
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(result.current.totalCount).toBe(1)
  expect(result.current.hasMoreBelow).toBe(false)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBeUndefined() })
  expect(getShopCatalog).toHaveBeenCalledTimes(1)
})

it("returns false for an incomplete jump, retains counts, and retries only when explicitly requested", async () => {
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {})
  jest.mocked(getShopCatalog).mockResolvedValueOnce(response([], 1)).mockResolvedValueOnce(response())
  const { result } = renderHook(() => useShopCatalog("site", initial, 2, "", offsets))
  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 1)).toBe(false) })
  expect(result.current.categoryOffsets).toEqual(offsets)
  expect(result.current.catalogItems).toEqual(initial)
  expect(result.current.totalCount).toBe(2)
  expect(result.current.pendingScrollCategory).toBeNull()
  expect(getShopCatalog).toHaveBeenCalledTimes(1)
  await act(async () => { expect(await result.current.jumpToCategory(1, "Tea", 1)).toBe(true) })
  errorLog.mockRestore()
})

it("cancels a pending category request when the site changes and leaves the new site retryable", async () => {
  let resolveOld!: (value: ReturnType<typeof response>) => void
  jest.mocked(getShopCatalog).mockReturnValueOnce(new Promise((done) => { resolveOld = done })).mockResolvedValueOnce(response())
  const { result, rerender } = renderHook(({ site }) => useShopCatalog(site, initial, 2, "", offsets), { initialProps: { site: "site" } })
  let oldLoading!: Promise<LoadResult>
  act(() => { oldLoading = result.current.jumpToCategory(1, "Tea", 1) })
  rerender({ site: "new-site" })
  await act(async () => { resolveOld(response([shopItem("stale", "Tea")])); expect(await oldLoading).toBeUndefined() })
  expect(result.current.catalogItems).toEqual(initial)
  expect(result.current.isJumping).toBe(false)
  await act(async () => { expect(await result.current.loadMoreBelow()).toBe(true) })
  expect(getShopCatalog).toHaveBeenLastCalledWith("new-site", { offset: 0, pageSize: 100, search: "", category: "Tea" })
})

it("keeps search results separate from category browsing and restores the initial feed on clear", async () => {
  jest.mocked(getShopCatalog).mockResolvedValue(response())
  const { result, rerender } = renderHook(({ search }) => useShopCatalog("site", initial, 2, search, offsets), {
    initialProps: { search: "" },
  })
  rerender({ search: "tea" })
  await waitFor(() => expect(result.current.catalogItems).toEqual([tea]))
  expect(getShopCatalog).toHaveBeenLastCalledWith("site", { offset: 0, pageSize: 20, search: "tea" })
  rerender({ search: "" })
  expect(result.current.catalogItems).toEqual(initial)
})