import { useState, type ComponentProps } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import type { CatalogListingCard } from "@/app/components/commerce/CatalogListingCard"
import type { PromoCarousel } from "@/app/components/commerce/PromoCarousel"
import type { ShopDeviceOrders } from "@/app/shop/[siteSlug]/ShopDeviceOrders"
import { ShopCatalogMain } from "@/app/shop/[siteSlug]/ShopCatalogMain"
import { categoryDomId } from "@/app/shop/[siteSlug]/shop-catalog-shared"
import { useShopCategorySpy } from "@/app/shop/[siteSlug]/useShopCategorySpy"
import { shopItem } from "./catalog-fixture"
import { useShopCatalog } from "@/app/shop/[siteSlug]/useShopCatalog"
import { getShopCatalog } from "@/app/shop/[siteSlug]/actions"

jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopCatalog: jest.fn() }))

jest.mock("@/app/shop/[siteSlug]/useShopCategorySpy", () => ({ useShopCategorySpy: jest.fn() }))
jest.mock("@/app/components/commerce/CatalogListingCard", () => ({
  CatalogListingCard: ({ item, href }: ComponentProps<typeof CatalogListingCard>) => (
    <article data-testid={`card-${item.id}`}><a href={href}>{item.name}</a></article>
  ),
}))
jest.mock("@/app/components/commerce/FeaturedListingPoster", () => ({
  ...jest.requireActual("@/app/components/commerce/FeaturedListingPoster"),
  FeaturedListingsRail: () => <div data-testid="featured-rail" />,
}))
jest.mock("@/app/components/commerce/PromoListingCard", () => ({
  PromoListingCard: () => <div data-testid="category-promo" />,
}))
jest.mock("@/app/components/commerce/PromoCarousel", () => ({
  PromoCarousel: ({ promos }: ComponentProps<typeof PromoCarousel>) => promos.length > 0
    ? <div data-testid="general-promos" /> : null,
}))
jest.mock("@/app/shop/[siteSlug]/ShopDeviceOrders", () => ({
  ShopDeviceOrders: ({ orders }: ComponentProps<typeof ShopDeviceOrders>) => orders.length > 0
    ? <div data-testid="device-orders" /> : null,
}))

type MainProps = ComponentProps<typeof ShopCatalogMain>
const coffee = shopItem("coffee", "Coffee")
const teas = [shopItem("tea-1", "Tea"), shopItem("tea-2", "Tea"), shopItem("tea-3", "Tea")]
const categoryOffsets = [
  { name: "Coffee", offset: 0, count: 1 },
  { name: "Tea", offset: 1, count: 3 },
  { name: "Other", offset: 4, count: 1 },
]
const mockSetActiveCategory = jest.fn()
const mockScrollToCategory = jest.fn()
const scrolledTargets: (HTMLElement | null)[] = []

class TestIntersectionObserver implements IntersectionObserver {
  static instances: TestIntersectionObserver[] = []
  readonly root = null
  readonly rootMargin: string
  readonly thresholds = [0]
  readonly observe = jest.fn()
  readonly unobserve = jest.fn()
  readonly disconnect = jest.fn()
  readonly takeRecords = jest.fn(() => [])

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin || "0px"
    TestIntersectionObserver.instances.push(this)
  }

  emit(targets: { target: Element; isIntersecting: boolean }[]) {
    this.callback(targets.map(({ target, isIntersecting }) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
      time: 0,
    })), this)
  }
}

const originalObserver = Object.getOwnPropertyDescriptor(window, "IntersectionObserver")
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo")

function props(overrides: Partial<MainProps> = {}): MainProps {
  return {
    siteSlug: "example",
    categories: ["Coffee", "Tea", "Other"],
    categoryOffsets,
    searchQuery: "",
    ownedItems: [],
    ownedAccessMap: new Map(),
    sellableCatalogItems: [coffee],
    rawCatalogItems: [coffee],
    initialCount: 15,
    isLoading: false,
    isLoadingMore: false,
    isJumping: false,
    hasMoreBelow: true,
    loadMoreBelow: jest.fn(),
    jumpToCategory: jest.fn(),
    pendingScrollCategory: null,
    clearPendingScrollCategory: jest.fn(),
    addToCart: jest.fn(),
    ...overrides,
  }
}

function ui(mainProps: MainProps) {
  return (
    <LocalizationProvider preferredLocale="en">
      <ShopCatalogMain {...mainProps} />
    </LocalizationProvider>
  )
}

const integrationOffsets = [{ name: "Coffee", offset: 0, count: 1 }, { name: "Tea", offset: 1, count: 3 }]
const integrationInitial = [coffee]
function LiveCatalogHarness() {
  const catalog = useShopCatalog("site", integrationInitial, 4, "", integrationOffsets)
  return ui(props({
    ...catalog,
    initialCount: catalog.totalCount,
    rawCatalogItems: catalog.catalogItems,
    sellableCatalogItems: catalog.catalogItems,
  }))
}

function finishCategoryRestore() {
  act(() => { jest.advanceTimersByTime(20) })
}

function observedTargets(observer: TestIntersectionObserver) {
  return observer.observe.mock.calls.map(([target]) => target as HTMLElement)
}

function latestObserver() {
  const observer = TestIntersectionObserver.instances.at(-1)
  expect(observer).toBeDefined()
  return observer!
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  TestIntersectionObserver.instances = []
  scrolledTargets.length = 0
  window.history.replaceState({}, "", "/shop/example")
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: TestIntersectionObserver })
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: jest.fn() })
  mockScrollToCategory.mockImplementation((name: string) => {
    const target = document.getElementById(name === "all" ? "shop-catalog-top" : categoryDomId(name))
    scrolledTargets.push(target)
    return Boolean(target)
  })
  jest.mocked(useShopCategorySpy).mockReturnValue({
    activeCategory: "all",
    setActiveCategory: mockSetActiveCategory,
    scrollToCategory: mockScrollToCategory,
  })
})

afterEach(() => {
  jest.useRealTimers()
  if (originalObserver) Object.defineProperty(window, "IntersectionObserver", originalObserver)
  else Reflect.deleteProperty(window, "IntersectionObserver")
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo)
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo")
})

describe("ShopCatalogMain search visibility", () => {
  it.each([
    { initialCount: 2, searchTruncated: undefined }, { initialCount: 200, searchTruncated: undefined },
    { searchTruncated: false }, { searchQuery: " " },
    { isLoading: true }, { isLoadingMore: true }, { isJumping: true },
    { hasMoreBelow: true }, { searchError: "Search unavailable" },
  ])("hides the ranked notice without confirmed overflow or completed results: %j", (overrides) => {
    render(ui(props({ searchQuery: "coffee", searchTruncated: true, hasMoreBelow: false, ...overrides })))
    expect(screen.queryByText(/Ranked results/)).not.toBeInTheDocument()
  })

  it("places confirmed overflow after all results, waits for the last page and hides it on clear", () => {
    const mainProps = props({ searchQuery: "coffee", searchTruncated: true, hasMoreBelow: true })
    const { rerender, container } = render(ui(mainProps))
    expect(screen.queryByText(/Ranked results/)).not.toBeInTheDocument()
    rerender(ui({ ...mainProps, hasMoreBelow: false }))
    const notice = screen.getByText(/Ranked results/)
    expect(screen.getByTestId("card-coffee").compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector("main")?.lastElementChild).toBe(notice)
    rerender(ui({ ...mainProps, searchQuery: " " }))
    expect(screen.queryByText(/Ranked results/)).not.toBeInTheDocument()
  })

  it.each(["results", "loading", "empty", "error"])("hides promotions and orders during search (%s) and restores them", (state) => {
    const promo = { id: "promo", name: "Coffee offer", catalog_item_ids: [], category_ids: [] }
    const mainProps = props({
      deviceOrders: [{ orderId: "order", publicAccessToken: "test-token" }],
      generalPromos: [promo],
      categoryPromosByName: { Coffee: [promo] },
    })
    const { rerender } = render(ui(mainProps))
    finishCategoryRestore()

    for (const id of ["device-orders", "general-promos", "category-promo"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }

    rerender(ui({
      ...mainProps,
      searchQuery: "  coffee  ",
      isLoading: state === "loading",
      searchError: state === "error" ? "Search unavailable" : undefined,
      sellableCatalogItems: state === "empty" ? [] : [coffee],
    }))

    for (const id of ["device-orders", "general-promos", "category-promo"]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
    if (state === "results") {
      expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument()
      expect(screen.getByTestId("card-coffee")).toBeInTheDocument()
    }
    if (state === "empty") expect(screen.getByText("No products found")).toBeInTheDocument()
    if (state === "error") expect(screen.getByRole("alert")).toHaveTextContent("Search unavailable")

    rerender(ui({ ...mainProps, searchQuery: "   " }))

    for (const id of ["device-orders", "general-promos", "category-promo"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.getByTestId("card-coffee")).toBeInTheDocument()
  })
})

describe("ShopCatalogMain category loading", () => {
  it("selects an unloaded category, requests its full count and scrolls to the existing placeholder target", () => {
    const mainProps = props()
    // Model the hook's immediate pending-scroll update, without loading any cards.
    function NavigationHarness({ loadedItems = [coffee] }: { loadedItems?: MainProps["sellableCatalogItems"] }) {
      const [pendingScrollCategory, setPending] = useState<string | null>(null)
      const [isJumping, setJumping] = useState(false)
      return ui({
        ...mainProps,
        sellableCatalogItems: loadedItems,
        rawCatalogItems: loadedItems,
        pendingScrollCategory,
        isJumping: isJumping && loadedItems.length === 1,
        jumpToCategory: (...args) => {
          mainProps.jumpToCategory(...args)
          setPending(args[1])
          setJumping(true)
        },
        clearPendingScrollCategory: () => {
          mainProps.clearPendingScrollCategory()
          setPending(null)
        },
      })
    }
    const { rerender } = render(<NavigationHarness />)
    finishCategoryRestore()
    const teaSection = document.getElementById(categoryDomId("Tea"))!
    const teaHeading = screen.getByRole("heading", { name: "Tea" })
    const coffeeCard = screen.getByTestId("card-coffee")
    expect(teaSection.querySelector("[data-shop-pending-space]")).toHaveAttribute("data-shop-pending-space", "3")

    fireEvent.click(screen.getByRole("button", { name: "Tea" }))

    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(1)
    expect(mainProps.jumpToCategory).toHaveBeenCalledWith(1, "Tea", 3)
    expect(mockSetActiveCategory).toHaveBeenCalledWith("Tea", 1500)
    expect(mockScrollToCategory).toHaveBeenCalledWith("Tea")
    expect(scrolledTargets).toEqual([teaSection])
    expect(mainProps.clearPendingScrollCategory).toHaveBeenCalledTimes(1)
    expect(document.getElementById(categoryDomId("Tea"))).toBe(teaSection)
    expect(screen.getByRole("heading", { name: "Tea" })).toBe(teaHeading)
    expect(screen.getByTestId("card-coffee")).toBe(coffeeCard)
    expect(teaSection.querySelector("[data-shop-pending-space]")).toHaveAttribute("data-shop-pending-space", "3")

    rerender(<NavigationHarness loadedItems={[coffee, ...teas]} />)

    expect(mockScrollToCategory).toHaveBeenCalledTimes(1)
    expect(mainProps.clearPendingScrollCategory).toHaveBeenCalledTimes(1)
    expect(document.getElementById(categoryDomId("Tea"))).toBe(teaSection)
    expect(screen.getByRole("heading", { name: "Tea" })).toBe(teaHeading)
    expect(screen.getByTestId("card-coffee")).toBe(coffeeCard)
    expect(teaSection.querySelectorAll("article")).toHaveLength(3)
    expect(teaSection.querySelectorAll("[data-shop-placeholder]")).toHaveLength(0)
  })

  it("still requests a partially loaded category instead of treating its mounted heading as complete", () => {
    const mainProps = props({ sellableCatalogItems: [coffee, teas[0]], rawCatalogItems: [coffee, teas[0]] })
    render(ui(mainProps))
    finishCategoryRestore()

    fireEvent.click(screen.getByRole("button", { name: "Tea" }))

    expect(mainProps.jumpToCategory).toHaveBeenCalledWith(1, "Tea", 3)
    expect(document.getElementById(categoryDomId("Tea"))?.querySelector("[data-shop-pending-space]"))
      .toHaveAttribute("data-shop-pending-space", "2")
  })

  it("scrolls to a fully raw-loaded category without fetching fulfillment-hidden cards", () => {
    const mainProps = props({ sellableCatalogItems: [coffee, teas[0]], rawCatalogItems: [coffee, ...teas] })
    render(ui(mainProps))
    finishCategoryRestore()

    fireEvent.click(screen.getByRole("button", { name: "Tea" }))

    expect(mainProps.jumpToCategory).not.toHaveBeenCalled()
    expect(mockScrollToCategory).toHaveBeenCalledWith("Tea")
    expect(document.getElementById(categoryDomId("Tea"))?.querySelectorAll("[data-shop-placeholder]"))
      .toHaveLength(0)
    expect(screen.queryByTestId("card-tea-2")).not.toBeInTheDocument()
  })

  it("requests a nearby pending category without navigation and never observes the bottom sentinel in section mode", async () => {
    const mainProps = props()
    jest.mocked(mainProps.jumpToCategory).mockResolvedValue(true)
    const { container, rerender } = render(ui(mainProps))
    finishCategoryRestore()
    const observer = latestObserver()
    const teaSection = document.getElementById(categoryDomId("Tea"))!
    const otherSection = document.getElementById(categoryDomId("Other"))!
    const sentinel = container.querySelector('.h-8.w-full[aria-hidden="true"]')!

    expect(observedTargets(observer)).toEqual([teaSection, otherSection])
    expect(observer.rootMargin).toBe("240px 0px")
    expect(sentinel).toBeInTheDocument()
    expect(TestIntersectionObserver.instances.flatMap(observedTargets)).not.toContain(sentinel)
    expect(jest.mocked(useShopCategorySpy)).toHaveBeenLastCalledWith(["Coffee", "Tea", "Other"], true)
    act(() => { observer.emit([{ target: teaSection, isIntersecting: false }]) })
    expect(mainProps.jumpToCategory).not.toHaveBeenCalled()

    act(() => { observer.emit([
      { target: teaSection, isIntersecting: true },
      { target: otherSection, isIntersecting: true },
    ]) })

    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(1)
    expect(mainProps.jumpToCategory).toHaveBeenCalledWith(1, "Tea", 3, false)
    expect(observer.disconnect).not.toHaveBeenCalled()
    expect(mockScrollToCategory).not.toHaveBeenCalled()
    expect(mainProps.loadMoreBelow).not.toHaveBeenCalled()
    await act(async () => {})

    // A still-partial response must not automatically re-request the same category.
    rerender(ui({ ...mainProps, sellableCatalogItems: [coffee, teas[0]], rawCatalogItems: [coffee, teas[0]] }))
    expect(observedTargets(latestObserver())).toEqual([otherSection])
    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])("search has no category placeholders and uses only feed loading (isLoading=%s)", (isLoading) => {
    const mainProps = props({
      searchQuery: "  tea  ",
      sellableCatalogItems: teas,
      rawCatalogItems: teas,
      isLoading,
    })
    const { container } = render(ui(mainProps))
    const observer = isLoading ? null : latestObserver()
    const targets = observer ? observedTargets(observer) : []

    expect(screen.getByRole("heading", { name: "Results" })).toBeInTheDocument()
    expect(container.querySelectorAll("[data-shop-category], [data-shop-placeholder]")).toHaveLength(0)
    expect(screen.queryByRole("button", { name: "Tea" })).not.toBeInTheDocument()
    expect(jest.mocked(useShopCategorySpy)).toHaveBeenLastCalledWith([], false)
    expect(targets).toHaveLength(isLoading ? 0 : 1)
    if (targets[0]) expect(targets[0]).toHaveClass("h-8", "w-full")
    expect(screen.queryAllByRole("article")).toHaveLength(isLoading ? 0 : 3)
    expect(container.querySelectorAll(".aspect-square")).toHaveLength(isLoading ? 6 : 0)

    if (observer) act(() => { observer.emit([{ target: targets[0], isIntersecting: true }]) })
    expect(mainProps.jumpToCategory).not.toHaveBeenCalled()
    expect(mainProps.loadMoreBelow).toHaveBeenCalledTimes(isLoading ? 0 : 1)
  })

  it("does not add a duplicate bottom loading grid while category placeholders are mounted", () => {
    const { container } = render(ui(props({ isLoadingMore: true })))
    finishCategoryRestore()

    expect(container.querySelectorAll("[data-shop-pending-space]")).toHaveLength(2)
    expect(container.querySelectorAll(".aspect-square")).toHaveLength(0)
    expect(screen.getByTestId("card-coffee")).toBeInTheDocument()
    expect(TestIntersectionObserver.instances.every((observer) => observer.rootMargin === "400px 0px")).toBe(true)
  })

  it("loads the global feed when category counts underestimate the total and no placeholders remain", async () => {
    const mainProps = props({
      categories: ["Coffee"],
      categoryOffsets: [{ name: "Coffee", offset: 0, count: 1 }],
      initialCount: 2,
    })
    const { container } = render(ui(mainProps))
    finishCategoryRestore()
    const observer = latestObserver()
    const sentinel = container.querySelector('.h-8.w-full[aria-hidden="true"]')!
    expect(observedTargets(observer)).toEqual([sentinel])
    await act(async () => { observer.emit([{ target: sentinel, isIntersecting: true }]) })
    expect(mainProps.loadMoreBelow).toHaveBeenCalledTimes(1)
    expect(mainProps.jumpToCategory).not.toHaveBeenCalled()
  })

  it("retries a failed category only after leaving and returning, without an immediate request loop", async () => {
    const mainProps = props()
    jest.mocked(mainProps.jumpToCategory).mockResolvedValueOnce(false).mockResolvedValue(true)
    render(ui(mainProps))
    finishCategoryRestore()
    const tea = document.getElementById(categoryDomId("Tea"))!
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: true }]) })
    expect(screen.getByRole("button", { name: "Retry loading products" })).toBeInTheDocument()
    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(1)
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: true }]) })
    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(1)
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: false }]) })
    expect(screen.queryByRole("button", { name: "Retry loading products" })).not.toBeInTheDocument()
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: true }]) })
    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(2)
    expect(mockScrollToCategory).not.toHaveBeenCalled()
  })

  it.each(["online", "button"])("can retry a failed category through %s while it remains visible", async (trigger) => {
    const mainProps = props()
    jest.mocked(mainProps.jumpToCategory).mockRejectedValueOnce(new Error("Network failure")).mockResolvedValue(true)
    render(ui(mainProps))
    finishCategoryRestore()
    const tea = document.getElementById(categoryDomId("Tea"))!
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: true }]) })
    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(1)
    if (trigger === "online") fireEvent(window, new Event("online"))
    else fireEvent.click(screen.getByRole("button", { name: "Retry loading products" }))
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: true }]) })
    expect(mainProps.jumpToCategory).toHaveBeenCalledTimes(2)
  })

  it("removes a reconciled empty category instead of keeping its original pending slots", () => {
    const mainProps = props()
    const { container, rerender } = render(ui(mainProps))
    finishCategoryRestore()
    expect(container.querySelector(`#${categoryDomId("Tea")} [data-shop-pending-space]`)).toBeInTheDocument()
    rerender(ui({ ...mainProps, categoryOffsets: categoryOffsets.map((category) => category.name === "Tea" ? { ...category, count: 0 } : category) }))
    expect(container.querySelector(`#${categoryDomId("Tea")}`)).not.toBeInTheDocument()
  })

  it.each([0, 2])("reconciles a real category response with count=%i and retires the original placeholders", async (count) => {
    jest.mocked(getShopCatalog).mockResolvedValue({
      data: teas.slice(0, count), count, offset: 0, page: 1, pageSize: 100, totalPages: 1,
    })
    const { container } = render(<LiveCatalogHarness />)
    finishCategoryRestore()
    const tea = document.getElementById(categoryDomId("Tea"))!
    expect(tea).toHaveAttribute("data-shop-pending-count", "3")
    await act(async () => { latestObserver().emit([{ target: tea, isIntersecting: true }]) })
    await waitFor(() => {
      if (count === 0) expect(document.getElementById(categoryDomId("Tea"))).toBeNull()
      else expect(document.getElementById(categoryDomId("Tea"))).toHaveAttribute("data-shop-pending-count", "0")
    })
    expect(container.querySelectorAll("[data-shop-pending-space]")).toHaveLength(0)
    expect(screen.getByTestId("card-coffee")).toBeInTheDocument()
    expect(getShopCatalog).toHaveBeenCalledTimes(1)
  })

  it("keeps the mounted grid geometry when reconciled counts cross layout thresholds", () => {
    const mainProps = props({ initialCount: 15 })
    const { container, rerender } = render(ui(mainProps))
    finishCategoryRestore()
    const coffeeGrid = container.querySelector("[data-shop-category-grid] > .grid")!
    expect(coffeeGrid).toHaveClass("grid-cols-2")
    rerender(ui({ ...mainProps, initialCount: 5 }))
    expect(container.querySelector("[data-shop-category-grid] > .grid")).toBe(coffeeGrid)
    expect(coffeeGrid).toHaveClass("grid-cols-2")
  })
})