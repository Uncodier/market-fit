import { StrictMode, type ComponentProps } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { ShopCatalogMain } from "@/app/shop/[siteSlug]/ShopCatalogMain"
import { ShopResultsGroup } from "@/app/shop/[siteSlug]/ShopResultsGroup"
import { useShopCatalog } from "@/app/shop/[siteSlug]/useShopCatalog"
import { getShopCatalog } from "@/app/shop/[siteSlug]/actions"
import { MarketplaceProductList } from "@/app/marketplace/MarketplaceProductList"
import { useMarketplaceProducts } from "@/app/marketplace/useMarketplaceProducts"
import { shopItem } from "../shop/catalog-fixture"
import { marketplaceItem } from "../marketplace/catalog-fixture"

jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopCatalog: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => jest.requireActual("@/app/context/locale-catalog").localeMessages.en[key] || key,
  }),
}))
jest.mock("@/app/shop/[siteSlug]/useShopCategorySpy", () => ({
  useShopCategorySpy: () => ({ activeCategory: "all", setActiveCategory: jest.fn(), scrollToCategory: jest.fn() }),
}))
jest.mock("@/app/shop/[siteSlug]/useShopCatalogViewport", () => ({
  useShopCatalogViewport: () => ({ failedCategories: [], retry: jest.fn() }),
}))
jest.mock("@/app/shop/[siteSlug]/ShopDeviceOrders", () => ({ ShopDeviceOrders: () => null }))
jest.mock("@/app/shop/[siteSlug]/ShopCategoryChips", () => ({ ShopCategoryChips: () => null }))
jest.mock("@/app/components/commerce/PromoCarousel", () => ({ PromoCarousel: () => null }))
jest.mock("@/app/components/commerce/PromoListingCard", () => ({ PromoListingCard: () => null }))
jest.mock("@/app/components/commerce/CatalogListingCard", () => ({
  CatalogListingCard: ({ item }: ComponentProps<typeof import("@/app/components/commerce/CatalogListingCard").CatalogListingCard>) => <article>{item.name}</article>,
}))
jest.mock("@/app/components/commerce/FeaturedListingPoster", () => ({
  FEATURED_LISTING_THRESHOLD: 3,
  FeaturedListingsRail: ({ items }: { items: Array<{ name: string }> }) => <div>{items.map(item => item.name).join(", ")}</div>,
}))

const shopInitial = [shopItem("Coffee", "Drinks")]
const shopOffsets: [] = []
const marketplaceInitial = [marketplaceItem("Coffee")]
const renders: boolean[] = []

function ShopHarness({ query }: { query: string }) {
  const catalog = useShopCatalog("site", shopInitial, 12, query, shopOffsets)
  renders.push(catalog.isLoading)
  return <ShopCatalogMain
    {...catalog} siteSlug="example" categories={[]} searchQuery={query}
    initialCount={12} sellableCatalogItems={catalog.catalogItems}
    ownedItems={[]} ownedAccessMap={new Map()} addToCart={jest.fn()}
    deviceOrders={[{ orderId: "order", publicAccessToken: "test-token" }]}
  />
}

function MarketplaceHarness({ query }: { query: string }) {
  const catalog = useMarketplaceProducts(marketplaceInitial, 2, query, "all", "all", false)
  renders.push(catalog.isLoading)
  return <MarketplaceProductList {...catalog} initialCount={catalog.count}
    globalInitialCount={12} compactMobile={false} onPrimaryAction={jest.fn()} />
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

const shopResponse = (count: number) => ({
  data: count ? [shopItem("Tea result", "Drinks")] : [], count,
  offset: 0, page: 1, pageSize: 20, totalPages: count ? 1 : 0,
})
const marketplaceResponse = (count: number) => ({
  ok: true, status: 200,
  json: async () => ({ data: count ? [marketplaceItem("Tea result")] : [], count, totalPages: count ? 1 : 0 }),
}) as Response

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(getShopCatalog).mockReset()
  jest.mocked(fetch).mockReset()
  window.history.replaceState(null, "", "/marketplace")
  jest.spyOn(window, "scrollTo").mockImplementation(() => {})
  renders.length = 0
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it.each([0, 1])("replaces the Shop result count with an animated skeleton until loading finishes (count=%i)", count => {
  const props = { isSearching: true, resultKind: "matched" as const, count, isLoading: true, showCount: true }
  const { container, rerender } = render(<ShopResultsGroup {...props} />)
  expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
  expect(screen.queryByText(`${count} ${count === 1 ? "product" : "products"}`)).not.toBeInTheDocument()
  rerender(<ShopResultsGroup {...props} isLoading={false} />)
  expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument()
  expect(screen.getByText(`${count} ${count === 1 ? "product" : "products"}`)).toBeInTheDocument()
})

describe.each(["Shop", "Marketplace"] as const)("%s search loading", surface => {
  const Harness = surface === "Shop" ? ShopHarness : MarketplaceHarness
  const noResults = surface === "Shop" ? "No products found" : "No results found"

  it.each([0, 1])("shows animated cards throughout debounce and a slow request, then renders the completed result (count=%i)", async count => {
    const shopRequest = deferred<Awaited<ReturnType<typeof getShopCatalog>>>()
    const marketplaceRequest = deferred<Response>()
    jest.mocked(getShopCatalog).mockReturnValue(shopRequest.promise)
    jest.mocked(fetch).mockReturnValue(marketplaceRequest.promise)
    const { container, rerender } = render(<Harness query="" />)
    expect(renders[0]).toBe(false)
    renders.length = 0
    rerender(<Harness query="tea" />)

    expect(renders.every(Boolean)).toBe(true)
    expect(container.querySelector('[aria-busy="true"] .animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText("0 products")).not.toBeInTheDocument()
    expect(screen.queryByText(noResults)).not.toBeInTheDocument()
    expect(screen.queryByText("Coffee")).not.toBeInTheDocument()
    expect(getShopCatalog).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()

    await act(async () => { jest.advanceTimersByTime(299) })
    expect(getShopCatalog).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => { jest.advanceTimersByTime(1) })
    expect(container.querySelector('[aria-busy="true"] .animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText(noResults)).not.toBeInTheDocument()

    await act(async () => {
      if (surface === "Shop") shopRequest.resolve(shopResponse(count))
      else marketplaceRequest.resolve(marketplaceResponse(count))
    })
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument()
    if (count) expect(screen.getByText("Tea result")).toBeInTheDocument()
    else expect(screen.getByText(noResults)).toBeInTheDocument()
  })

  it("starts a mounted nonempty query in loading state", async () => {
    jest.mocked(getShopCatalog).mockResolvedValue(shopResponse(1))
    jest.mocked(fetch).mockResolvedValue(marketplaceResponse(1))
    const { container } = render(<StrictMode><Harness query="tea" /></StrictMode>)
    expect(renders.every(Boolean)).toBe(true)
    expect(container.querySelector('[aria-busy="true"] .animate-pulse')).toBeInTheDocument()
    await act(async () => { jest.advanceTimersByTime(300) })
    expect(screen.getByText("Tea result")).toBeInTheDocument()
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument()
  })

  it("keeps a newer search loading when an obsolete request completes", async () => {
    const oldShop = deferred<Awaited<ReturnType<typeof getShopCatalog>>>()
    const oldMarketplace = deferred<Response>()
    const newShop = deferred<Awaited<ReturnType<typeof getShopCatalog>>>()
    const newMarketplace = deferred<Response>()
    jest.mocked(getShopCatalog).mockReturnValueOnce(oldShop.promise).mockReturnValueOnce(newShop.promise)
    jest.mocked(fetch).mockReturnValueOnce(oldMarketplace.promise).mockReturnValueOnce(newMarketplace.promise)
    const { container, rerender } = render(<Harness query="tea" />)
    await act(async () => { jest.advanceTimersByTime(300) })
    rerender(<Harness query="other" />)
    await act(async () => {
      if (surface === "Shop") oldShop.resolve(shopResponse(0))
      else oldMarketplace.resolve(marketplaceResponse(0))
    })
    expect(container.querySelector('[aria-busy="true"] .animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText(noResults)).not.toBeInTheDocument()
    await act(async () => { jest.advanceTimersByTime(300) })
    await act(async () => {
      if (surface === "Shop") newShop.resolve(shopResponse(1))
      else newMarketplace.resolve(marketplaceResponse(1))
    })
    expect(screen.getByText("Tea result")).toBeInTheDocument()
  })
})

it("hides stale Marketplace pagination while cards are loading", () => {
  const setPage = jest.fn()
  const props = { items: marketplaceInitial, initialCount: 12, isLoading: true,
    compactMobile: false, page: 1, totalPages: 2, setPage, onPrimaryAction: jest.fn() }
  const { container, rerender } = render(<MarketplaceProductList {...props} />)
  expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument()
  rerender(<MarketplaceProductList {...props} isLoading={false} />)
  fireEvent.click(screen.getByRole("button", { name: "2" }))
  expect(setPage).toHaveBeenCalledWith(2)
})