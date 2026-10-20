import { act, renderHook } from "@testing-library/react"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import type { MarketplaceSort } from "@/app/marketplace/marketplace-sort"
import { useMarketplaceProducts } from "@/app/marketplace/useMarketplaceProducts"
import { marketplaceItem } from "./catalog-fixture"
import type { MarketplaceListingFilters } from "@/app/marketplace/marketplace-product-filters"
import { buildMarketplaceSortSearch } from "@/app/marketplace/marketplace-sort"
import { buildMarketplaceCategorySearch } from "@/app/marketplace/marketplace-category-url"
import { buildMarketplaceListingFilterSearch } from "@/app/marketplace/marketplace-filter-url"

const initial = [marketplaceItem("SSR featured")]
const sorted = [marketplaceItem("API sorted")]
const fetchMock = jest.mocked(fetch)
const response = (data = sorted, totalPages = 5) => ({
  ok: true, json: async () => ({ data, totalPages, count: data.length ? 83 : 0, regions: [{ country: "mexico", label: "Mexico", count: 60 }] }),
}) as Response

type Filters = {
  sort?: MarketplaceSort
  geo?: BuyerGeo
  search?: string
  kind?: string
  subtype?: string
  recurring?: boolean
  listing?: MarketplaceListingFilters
  siteId?: string
}

function mount(initialProps: Filters = {}) {
  return renderHook((filters: Filters) => useMarketplaceProducts(
    initial, 3, filters.search || "", filters.kind || "all", filters.subtype || "all",
    filters.recurring || false, filters.sort, filters.geo, filters.listing, undefined, undefined, filters.siteId,
  ), { initialProps })
}

async function flushRequest() {
  await act(async () => { jest.advanceTimersByTime(300) })
}

function requestParams(call = fetchMock.mock.calls.length - 1) {
  return new URL(String(fetchMock.mock.calls[call][0]), "http://localhost").searchParams
}

beforeEach(() => {
  window.history.replaceState(null, "", "/marketplace")
  jest.useFakeTimers()
  fetchMock.mockReset().mockResolvedValue(response())
  jest.spyOn(window, "scrollTo").mockImplementation(() => {})
})

it("continues the original 60-rank snapshot on page 2 after provider recovery, then 409 expiry restarts page 1 without duplicates", async () => {
  const oldId = "11111111-1111-4111-8111-111111111111"
  const newId = "22222222-2222-4222-8222-222222222222"
  const ranks = Array.from({ length: 60 }, (_, index) => marketplaceItem(`Rank ${index + 1}`))
  fetchMock.mockImplementation(async input => {
    const params = new URL(String(input), "http://localhost").searchParams
    const page = Number(params.get("page"))
    return { ok: true, status: 200, json: async () => ({ data: ranks.slice((page - 1) * 36, page * 36),
      count: 60, totalPages: 2, count_kind: "candidate_window", mode: "text", degraded: true, search_id: oldId }) } as Response
  })
  const { result } = mount({ search: "comfortable shoes" })
  await flushRequest()
  expect(result.current.items).toHaveLength(36)
  expect(new URLSearchParams(window.location.search).get("search_id")).toBe(oldId)
  act(() => result.current.setPage(2))
  await flushRequest()
  expect(requestParams().get("search_id")).toBe(oldId)
  expect(result.current.items.map(item => item.id)).toEqual(ranks.slice(36).map(item => item.id))
  expect(new URLSearchParams(window.location.search).get("page")).toBe("2")
  fetchMock.mockResolvedValueOnce({ ok: false, status: 409 } as Response)
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: ranks.slice(0, 36), count: 60,
      totalPages: 2, search_id: newId, mode: "hybrid", degraded: false, count_kind: "candidate_window" }) } as Response)
  act(() => result.current.retry())
  await flushRequest()
  expect(result.current.page).toBe(1)
  expect(result.current.items).toEqual([])
  expect(new URLSearchParams(window.location.search).has("search_id")).toBe(false)
  await flushRequest()
  expect(requestParams().get("page")).toBe("1")
  expect(requestParams().has("search_id")).toBe(false)
  expect(result.current.items.map(item => item.id)).toEqual(ranks.slice(0, 36).map(item => item.id))
  expect(new Set(result.current.items.map(item => item.id)).size).toBe(36)
  expect(result.current.error).toBeUndefined()
})

it.each([
  { search: "different query" }, { kind: "product" }, { subtype: "ticket" }, { recurring: true },
  { sort: "newest" }, { listing: { maxPrice: 50 } }, { siteId: "site-two" },
] as Filters[])("resets snapshot and page before fetching a changed scope %j", async next => {
  const id = "11111111-1111-4111-8111-111111111111"
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: sorted, count: 60, totalPages: 2, search_id: id }) } as Response)
  const { result, rerender } = mount({ search: "original query" })
  await flushRequest()
  act(() => result.current.setPage(2))
  await flushRequest()
  expect(requestParams().get("search_id")).toBe(id)
  rerender({ search: "original query", ...next })
  expect(result.current.page).toBe(1)
  expect(new URLSearchParams(window.location.search).has("search_id")).toBe(false)
  await flushRequest()
  expect(requestParams().get("page")).toBe("1")
  expect(requestParams().has("search_id")).toBe(false)
})

it("restores a URL search continuation on mount while plain browsing ignores snapshot/page params", async () => {
  const id = "11111111-1111-4111-8111-111111111111"
  window.history.replaceState(null, "", `/marketplace?search=shoes&page=2&search_id=${id}`)
  const searched = mount({ search: "shoes" })
  await flushRequest()
  expect(requestParams().get("page")).toBe("2")
  expect(requestParams().get("search_id")).toBe(id)
  searched.unmount()
  window.history.replaceState(null, "", `/marketplace?page=2&search_id=${id}`)
  const browse = mount()
  await flushRequest()
  expect(browse.result.current.page).toBe(1)
  expect(browse.result.current.items).toEqual(initial)
  expect(new URLSearchParams(window.location.search).has("search_id")).toBe(false)
})

it("category, sorting and listing filter URL changes clear page/ID and retain unrelated checkout params", () => {
  const source = "search=shoes&page=2&search_id=11111111-1111-4111-8111-111111111111&ownerSiteId=buyer"
  for (const result of [buildMarketplaceSortSearch(source, "newest"),
    buildMarketplaceCategorySearch(source, { kind: "product", subtype: "all" }),
    buildMarketplaceListingFilterSearch(source, { maxPrice: 50 })]) {
    const params = new URLSearchParams(result)
    expect(params.has("page")).toBe(false)
    expect(params.has("search_id")).toBe(false)
    expect(params.get("ownerSiteId")).toBe("buyer")
    expect(params.get("search")).toBe("shoes")
  }
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("reuses SSR only for the global featured first page (including empty geo)", async () => {
  const { result, rerender } = mount()
  await flushRequest()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(result.current.items).toEqual(initial)
  expect(result.current.totalPages).toBe(3)
  expect(result.current.isLoading).toBe(false)
  rerender({ sort: "featured", geo: {} })
  await flushRequest()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(["best_selling", "newest", "price_asc", "price_desc"] as const)(
  "fetches %s on initial mount instead of reusing SSR", async (sort) => {
    const { result } = mount({ sort })
    expect(result.current.isLoading).toBe(true)
    await flushRequest()
    expect(requestParams().get("sort")).toBe(sort)
    expect(requestParams().get("page")).toBe("1")
    expect(requestParams().get("limit")).toBe("36")
    expect(result.current.items).toEqual(sorted)
    expect(result.current.totalPages).toBe(5)
    expect(result.current.isLoading).toBe(false)
  },
)

it("requests location-aware featured with all six string fields unchanged", async () => {
  const geo = {
    city: "San Miguel", state: "Guanajuato", country: "Mexico", zip: "00123",
    latitude: "0", longitude: "-100.1234",
  }
  const { result } = mount({ sort: "featured", geo })
  await flushRequest()
  expect(requestParams().get("sort")).toBe("featured")
  for (const [key, value] of Object.entries(geo)) expect(requestParams().get(key)).toBe(value)
  expect(result.current.items).toEqual(sorted)
})

it("keeps search, category, subtype and recurrence in sorted requests", async () => {
  mount({ sort: "newest", search: "Coffee & tea", kind: "digital_asset", subtype: "course", recurring: true })
  await flushRequest()
  expect(Object.fromEntries(requestParams())).toEqual({
    sort: "newest", page: "1", limit: "36", search: "Coffee & tea",
    kind: "digital_asset", digitalSubtype: "course", is_recurring: "true",
  })
})

it("maps subscription category to recurrence without sending an invalid kind", async () => {
  mount({ sort: "price_asc", kind: "recurring", subtype: "course" })
  await flushRequest()
  expect(requestParams().get("is_recurring")).toBe("true")
  expect(requestParams().has("kind")).toBe(false)
  expect(requestParams().has("digitalSubtype")).toBe(false)
})

it("requests later global featured pages rather than repeating SSR", async () => {
  const { result } = mount()
  act(() => result.current.setPage(2))
  await flushRequest()
  expect(requestParams().get("page")).toBe("2")
  expect(requestParams().get("sort")).toBe("featured")
  expect(requestParams().get("limit")).toBe("36")
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
})

it("resets pagination for sort and each location field, not geo object identity", async () => {
  const { result, rerender } = mount({ sort: "newest" })
  await flushRequest()
  act(() => result.current.setPage(3))
  await flushRequest()
  rerender({ sort: "price_desc" })
  expect(result.current.page).toBe(1)
  await flushRequest()
  expect(requestParams().get("page")).toBe("1")
  expect(requestParams().get("sort")).toBe("price_desc")

  let geo: BuyerGeo = {}
  for (const field of ["city", "state", "country", "zip", "latitude", "longitude"] as const) {
    act(() => result.current.setPage(2))
    await flushRequest()
    geo = { ...geo, [field]: "test value" }
    rerender({ sort: "price_desc", geo })
    expect(result.current.page).toBe(1)
    await flushRequest()
    expect(requestParams().get("page")).toBe("1")
    expect(requestParams().get(field)).toBe("test value")
  }
  const calls = fetchMock.mock.calls.length
  rerender({ sort: "price_desc", geo: { ...geo } })
  await flushRequest()
  expect(fetchMock).toHaveBeenCalledTimes(calls)
})

it("debounces changes before a request starts", async () => {
  const { rerender } = mount({ sort: "newest" })
  rerender({ sort: "price_asc" })
  rerender({ sort: "price_desc" })
  await flushRequest()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(requestParams().get("sort")).toBe("price_desc")
})

it("aborts stale fetches and ignores late responses without clearing newer loading", async () => {
  let resolveOld!: (value: Response) => void
  let resolveNew!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve }))
  const { result, rerender } = mount({ sort: "newest" })
  await flushRequest()
  const signal = fetchMock.mock.calls[0][1]?.signal
  rerender({ sort: "price_asc" })
  expect(signal?.aborted).toBe(true)
  await flushRequest()
  await act(async () => { resolveOld(response([marketplaceItem("stale")], 99)) })
  expect(result.current.items).toEqual(initial)
  expect(result.current.isLoading).toBe(true)
  await act(async () => { resolveNew(response()) })
  expect(result.current.items).toEqual(sorted)
  expect(result.current.totalPages).toBe(5)
  expect(result.current.isLoading).toBe(false)
})

it("restores SSR and clears loading on default return even with an in-flight request", async () => {
  let resolveOld!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
  const { result, rerender } = mount({ geo: { city: "Celaya" } })
  await flushRequest()
  expect(result.current.isLoading).toBe(true)
  rerender({ sort: "featured" })
  expect(result.current.items).toEqual(initial)
  expect(result.current.totalPages).toBe(3)
  expect(result.current.isLoading).toBe(false)
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await act(async () => { resolveOld(response()) })
  expect(result.current.items).toEqual(initial)
  await flushRequest()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("returns from a later sorted page to the first SSR page without fetching", async () => {
  const { result, rerender } = mount({ sort: "newest" })
  await flushRequest()
  act(() => result.current.setPage(3))
  await flushRequest()
  rerender({ sort: "featured" })
  expect(result.current.page).toBe(1)
  expect(result.current.items).toEqual(initial)
  expect(result.current.totalPages).toBe(3)
  expect(result.current.isLoading).toBe(false)
  await flushRequest()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("ignores stale JSON parsing and aborts when unmounted", async () => {
  let resolveJson!: (value: object) => void
  fetchMock.mockResolvedValueOnce({ ok: true, json: () => new Promise((resolve) => { resolveJson = resolve }) } as Response)
  const { result, rerender, unmount } = mount({ sort: "newest" })
  await flushRequest()
  rerender({ sort: "price_desc" })
  await flushRequest()
  await act(async () => { resolveJson({ data: [marketplaceItem("stale")], totalPages: 99 }) })
  expect(result.current.items).toEqual(sorted)
  unmount()
  expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true)
})

it("preserves items on HTTP failures, resets loading, and handles empty results", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  fetchMock.mockResolvedValueOnce({ ok: false } as Response).mockResolvedValueOnce(response([], 0))
  const { result, rerender } = mount({ sort: "newest" })
  await flushRequest()
  expect(result.current.items).toEqual(initial)
  expect(result.current.isLoading).toBe(false)
  rerender({ sort: "price_desc" })
  await flushRequest()
  expect(result.current.items).toEqual([])
  expect(result.current.totalPages).toBe(0)
})

it("resets loading on network failures and logs only active errors", async () => {
  const error = new Error("Network unavailable")
  const log = jest.spyOn(console, "error").mockImplementation(() => {})
  fetchMock.mockRejectedValueOnce(error)
  const { result } = mount({ sort: "newest" })
  await flushRequest()
  expect(result.current.items).toEqual(initial)
  expect(result.current.isLoading).toBe(false)
  expect(log).toHaveBeenCalledWith("Failed to fetch marketplace products:", error)
})

it("returns SSR global count and regions and restores them on clearing listing filters", async () => {
  const regions = [{ country: "mexico", label: "Mexico", count: 75 }]
  const { result, rerender } = renderHook((listing: MarketplaceListingFilters) => useMarketplaceProducts(
    initial, 3, "", "all", "all", false, "featured", undefined, listing, regions, 120,
  ), { initialProps: {} as MarketplaceListingFilters })
  expect(result.current.count).toBe(120)
  expect(result.current.regions).toEqual(regions)
  rerender({ availableOnly: true })
  expect(result.current.count).toBe(0)
  expect(result.current.regions).toEqual([])
  await flushRequest()
  expect(result.current.count).toBe(83)
  rerender({})
  expect(result.current.count).toBe(120)
  expect(result.current.regions).toEqual(regions)
})

it("sends all listing filters alongside independent buyer geography and resets pagination", async () => {
  const geo = { city: "Celaya", country: "Mexico" }
  const { result, rerender } = mount({ geo, listing: { regionCountry: "united states", minPrice: 0, maxPrice: 25.5, priceCurrency: "MXN", availableOnly: true } })
  await flushRequest()
  expect(Object.fromEntries(requestParams())).toMatchObject({ city: "Celaya", country: "Mexico", regionCountry: "united states",
    minPrice: "0", maxPrice: "25.5", priceCurrency: "MXN", availableOnly: "true" })
  act(() => result.current.setPage(3))
  await flushRequest()
  rerender({ geo, listing: { nearMe: true } })
  expect(result.current.page).toBe(1)
  await flushRequest()
  expect(requestParams().get("nearMe")).toBe("true")
  expect(requestParams().has("regionCountry")).toBe(false)
  expect(requestParams().has("minPrice")).toBe(false)
  expect(result.current.count).toBe(83)
  expect(result.current.regions).toEqual([{ country: "mexico", label: "Mexico", count: 60 }])
})

it.each([
  { regionCountry: "mexico" }, { nearMe: true }, { minPrice: 0 }, { maxPrice: 100 },
  { availableOnly: true }, { minPrice: 0, priceCurrency: "MXN" },
] as MarketplaceListingFilters[])("resets page and fetches for a listing filter change %j", async (listing) => {
  const { result, rerender } = mount({ sort: "newest" })
  await flushRequest()
  act(() => result.current.setPage(2))
  await flushRequest()
  rerender({ sort: "newest", listing })
  expect(result.current.page).toBe(1)
  await flushRequest()
  expect(requestParams().get("page")).toBe("1")
  const calls = fetchMock.mock.calls.length
  rerender({ sort: "newest", listing: { ...listing } })
  await flushRequest()
  expect(fetchMock).toHaveBeenCalledTimes(calls)
})

it("clears stale facet counts on HTTP failure and supports retry", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  const { result, rerender } = mount({ listing: { regionCountry: "mexico" } })
  await flushRequest()
  expect(result.current.count).toBe(83)
  fetchMock.mockResolvedValueOnce({ ok: false } as Response)
  rerender({ listing: { regionCountry: "united states" } })
  await flushRequest()
  expect(result.current.count).toBe(0)
  expect(result.current.regions).toEqual([])
  expect(result.current.totalPages).toBe(0)
  expect(result.current.error).toContain("Could not load")
  act(() => result.current.retry())
  await flushRequest()
  expect(result.current.error).toBeUndefined()
  expect(result.current.count).toBe(83)
})

it("preserves related and overflow metadata, clears both on query changes and defaults legacy matched", async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: sorted,
    count: 2, totalPages: 1, result_kind: "related", candidate_window_truncated: true }) } as Response)
  const { result, rerender } = mount({ search: "comfortable" })
  await flushRequest()
  expect(result.current.resultKind).toBe("related")
  expect(result.current.searchTruncated).toBe(true)
  rerender({ search: "coffee" })
  expect(result.current.resultKind).toBe("matched")
  expect(result.current.searchTruncated).toBe(false)
  await flushRequest()
  expect(result.current.resultKind).toBe("matched")
  rerender({ search: "" })
  expect(result.current.resultKind).toBe("matched")
})