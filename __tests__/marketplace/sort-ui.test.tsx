import { useState, type ComponentProps } from "react"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { MarketplaceClient } from "@/app/marketplace/MarketplaceClient"
import { MarketplaceCatalog } from "@/app/marketplace/MarketplaceCatalog"
import { MarketplaceSortControl } from "@/app/marketplace/MarketplaceSortControl"
import { useMarketplaceProducts } from "@/app/marketplace/useMarketplaceProducts"
import { useBuyerLocation } from "@/app/components/commerce/use-buyer-location"
import type { MarketplaceSort } from "@/app/marketplace/marketplace-sort"
import { marketplaceItem } from "./catalog-fixture"

jest.mock("@/app/marketplace/useMarketplaceProducts", () => ({ useMarketplaceProducts: jest.fn() }))
jest.mock("@/app/components/commerce/use-buyer-location", () => ({ useBuyerLocation: jest.fn() }))
jest.mock("@/app/marketplace/MarketplaceProductList", () => ({
  MarketplaceProductList: (props: { items: Array<{ name: string }>; initialCount: number; globalInitialCount: number }) => (
    <div data-testid="product-list" data-count={props.initialCount} data-global-count={props.globalInitialCount}>{props.items.map((item) => item.name).join(", ")}</div>
  ),
}))
jest.mock("@/app/marketplace/MarketplaceDiscountsFeed", () => ({
  MarketplaceDiscountsFeed: () => <div data-testid="discounts-feed">Discounts feed</div>,
}))
jest.mock("@/app/components/commerce/CommerceProductGrid", () => ({ shouldUseCompactMobileListing: () => false }))
jest.mock("@/app/marketplace/MarketplaceHeader", () => ({ MarketplaceHeader: () => <header>Marketplace</header> }))
jest.mock("@/app/marketplace/MarketplaceFooter", () => ({ MarketplaceFooter: () => <footer>Marketplace footer</footer> }))
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }))
jest.mock("@/app/commerce/cart-storage", () => ({
  getCartItems: () => [], setCartItems: jest.fn(), clearCart: jest.fn(),
}))
jest.mock("@/app/commerce/use-guest-checkout-prefill", () => ({ useGuestCheckoutPrefill: jest.fn() }))
jest.mock("@/app/components/commerce/PromoBundleExperience", () => ({ readPendingStorefrontPromo: () => null }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null, isLoading: false }) }))
jest.mock("@/app/marketplace/run-marketplace-checkout", () => ({ runMarketplaceCheckout: jest.fn() }))
jest.mock("@/app/book/actions", () => ({ getSiteInfoBySlug: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listPublicLocations: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const messages = jest.requireActual("@/app/context/locale-catalog").localeMessages.en
      const raw = messages[key] || key
      return Object.entries(params || {}).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), raw)
    },
    locale: "en", isReady: false,
  }),
}))
jest.mock("@/app/context/DisplayCurrencyContext", () => {
  const setStoreCurrency = jest.fn()
  return { useDisplayCurrency: () => ({ setStoreCurrency, displayCurrency: "USD" }) }
})

const initial = [marketplaceItem("Featured product")]
const location: ReturnType<typeof useBuyerLocation> = {
  effectiveBuyerGeo: { city: "Celaya", country: "Mexico" }, selectedLocationId: null,
  label: "Celaya", showPill: true, sheetOpen: false, setSheetOpen: jest.fn(), locating: false,
  applyPlace: jest.fn(), applyStore: jest.fn(), useMyLocation: jest.fn(), searchPlaces: jest.fn(),
}
const catalogProps: ComponentProps<typeof MarketplaceCatalog> = {
  initialItems: initial, initialCount: 30, initialTotalPages: 2, searchQuery: "",
  selectedKind: "all", selectedSubtype: "all", effectiveKind: "all",
  selectedSort: "featured", setSelectedSort: jest.fn(), setSelectedKind: jest.fn(), setSelectedSubtype: jest.fn(),
  buyerLocation: location, sellerLocationRestricted: null, onPrimaryAction: jest.fn(),
  discountsFeed: [], promoBadgesByItemId: {},
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() })
})

afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView") })

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useMarketplaceProducts).mockReturnValue({
    items: initial, page: 1, totalPages: 2, isLoading: false, setPage: jest.fn(),
    count: 30, regions: [], error: undefined, retry: jest.fn(),
  })
  jest.mocked(useBuyerLocation).mockReturnValue(location)
  jest.mocked(usePathname).mockReturnValue("/marketplace")
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
})

it("shows relevance and bounded-window scope instead of a misleading sales sort during search", () => {
  render(<MarketplaceCatalog {...catalogProps} searchQuery="comfortable" selectedSort="best_selling" />)
  expect(screen.queryByTitle("Sort by")).not.toBeInTheDocument()
  expect(screen.getByText(/Relevance · up to 200 candidates/)).toBeInTheDocument()
})

it.each([
  ["featured", "Featured"], ["best_selling", "Best selling"], ["newest", "Newest"],
  ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"],
] as const)("supports keyboard selection of %s with the shared icon menu", async (sort, label) => {
  const onChange = jest.fn()
  function Harness() {
    const [value, setValue] = useState<MarketplaceSort>(sort === "featured" ? "newest" : "featured")
    return <MarketplaceSortControl selectedSort={value} setSelectedSort={(next) => { setValue(next); onChange(next) }} />
  }
  render(<Harness />)
  const trigger = screen.getByTitle("Sort by")
  expect(trigger).toHaveAttribute("aria-haspopup", "menu")
  expect(trigger.querySelector("svg")).not.toBeNull()
  fireEvent.keyDown(trigger, { key: "ArrowDown" })
  const options = await screen.findAllByRole("menuitem")
  expect(options.map((option) => option.textContent)).toEqual([
    "Featured", "Best selling", "Newest", "Price: low to high", "Price: high to low",
  ])
  fireEvent.keyDown(screen.getByRole("menuitem", { name: label }), { key: "Enter" })
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(sort))
  expect(trigger).toHaveTextContent(label)
})

it("places a single responsive icon sorting menu above the grid, outside sidebar filters", () => {
  const { container } = render(<MarketplaceCatalog {...catalogProps} selectedSort="best_selling" />)
  const sidebar = container.querySelector("aside")!
  expect(sidebar).toHaveClass("hidden", "md:block")
  expect(within(sidebar).queryByTitle("Sort by")).not.toBeInTheDocument()
  const geo = within(sidebar).getByText("Celaya")
  const categories = within(sidebar).getByRole("heading", { name: "Categories" })
  expect(categories.compareDocumentPosition(geo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(sidebar).getByRole("button", { name: "Set your location" })).toHaveTextContent("Set")

  const sorts = screen.getAllByTitle("Sort by")
  expect(sorts).toHaveLength(1)
  expect(sorts.every((sort) => sort.textContent?.includes("Best selling"))).toBe(true)
  const gridSort = sorts[0]
  expect(gridSort.parentElement).toHaveAttribute("aria-label", "Catalog sorting")
  expect(gridSort.parentElement).toHaveClass("flex", "justify-end")
  expect(gridSort.parentElement).not.toHaveClass("md:hidden", "hidden")
  const mobileFilters = screen.getAllByRole("region", { name: "Product filters" }).find((section) => !sidebar.contains(section))!
  expect(mobileFilters.compareDocumentPosition(gridSort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const mobileCategory = screen.getAllByRole("button", { name: "Products" }).find((button) => !sidebar.contains(button))!
  expect(mobileCategory.compareDocumentPosition(gridSort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(mobileCategory.parentElement).not.toContainElement(within(mobileFilters).getByText("Celaya"))
  expect(gridSort.compareDocumentPosition(screen.getByTestId("product-list")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(useMarketplaceProducts).toHaveBeenCalledWith(initial, 2, "", "all", "all", false, "best_selling", location.effectiveBuyerGeo, {}, undefined, 30, undefined)
})

it("hides the sorting menu for Discounts and restores the persisted sort when leaving", () => {
  const { rerender } = render(<MarketplaceCatalog {...catalogProps} selectedKind="discounts" effectiveKind="discounts" selectedSort="price_desc" />)
  expect(screen.queryByTitle("Sort by")).not.toBeInTheDocument()
  expect(screen.getByTestId("discounts-feed")).toBeInTheDocument()
  expect(screen.queryByTestId("product-list")).not.toBeInTheDocument()
  expect(useMarketplaceProducts).toHaveBeenLastCalledWith(initial, 2, "", "all", "all", false, "featured", undefined, undefined, undefined, 30, undefined)
  expect(screen.queryByRole("region", { name: "Product filters" })).not.toBeInTheDocument()
  rerender(<MarketplaceCatalog {...catalogProps} selectedSort="price_desc" />)
  expect(screen.getByTitle("Sort by")).toHaveTextContent("Price: high to low")
  expect(screen.getByTestId("product-list")).toBeInTheDocument()
})

it("preserves listing and cart seller location restrictions after extraction", () => {
  const restricted = {
    ...initial[0], site: { ...initial[0].site, settings: {
      locations: [{ city: "London", restrictions: { enabled: true, included_addresses: [{ city: "London" }] } }],
    } },
  }
  jest.mocked(useMarketplaceProducts).mockReturnValue({ items: [restricted], page: 1, totalPages: 1, isLoading: false, setPage: jest.fn(), count: 1, regions: [], error: undefined, retry: jest.fn() })
  const { rerender } = render(<MarketplaceCatalog {...catalogProps} />)
  expect(screen.getAllByText("Celaya").every((label) => label.parentElement?.getAttribute("data-location-restricted") === "true")).toBe(true)
  rerender(<MarketplaceCatalog {...catalogProps} sellerLocationRestricted={false} />)
  expect(screen.getAllByText("Celaya").every((label) => label.parentElement?.getAttribute("data-location-restricted") === "false")).toBe(true)
})

it("initializes from the URL, persists mobile sort without losing other params, and follows URL updates", async () => {
  const params = new URLSearchParams("filter=digital_asset&subtype=course&sort=newest&ownerSiteId=buyer&returnTo=%2Fpurchases&city=Celaya")
  jest.mocked(useSearchParams).mockReturnValue(params as ReturnType<typeof useSearchParams>)
  const replace = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>)
  const props = { initialItems: initial, initialCount: 30, initialTotalPages: 2 }
  const { rerender } = render(<MarketplaceClient {...props} />)
  const sortMenu = screen.getByTitle("Sort by")
  expect(sortMenu).toHaveTextContent("Newest")
  fireEvent.keyDown(sortMenu, { key: "ArrowDown" })
  fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Price: low to high" }), { key: "Enter" })
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(1))
  expect(replace).toHaveBeenCalledWith(
    "/marketplace?filter=digital_asset&subtype=course&sort=price_asc&ownerSiteId=buyer&returnTo=%2Fpurchases&city=Celaya",
    { scroll: false },
  )

  params.set("sort", "best_selling")
  rerender(<MarketplaceClient {...props} />)
  expect(screen.getByTitle("Sort by")).toHaveTextContent("Best selling")
  params.set("sort", "unknown")
  rerender(<MarketplaceClient {...props} />)
  expect(screen.getByTitle("Sort by")).toHaveTextContent("Featured")
})

it("passes persisted listing filters and SSR facets without substituting listing country for buyer geography", () => {
  const params = new URLSearchParams("regionCountry=US&minPrice=0&maxPrice=50&priceCurrency=MXN&availableOnly=true")
  jest.mocked(useSearchParams).mockReturnValue(params as ReturnType<typeof useSearchParams>)
  const initialRegions = [{ country: "mexico", label: "Mexico", count: 20 }]
  render(<MarketplaceClient initialItems={initial} initialCount={30} initialTotalPages={2} initialRegions={initialRegions} />)
  expect(useMarketplaceProducts).toHaveBeenLastCalledWith(initial, 2, "", "all", "all", false, "featured",
    location.effectiveBuyerGeo, { regionCountry: "united states", minPrice: 0, maxPrice: 50, priceCurrency: "MXN", availableOnly: true }, initialRegions, 30, undefined)
  expect(screen.getAllByRole("radio", { name: "United States" }).every((radio) => radio.getAttribute("aria-checked") === "true")).toBe(true)
  expect(screen.getAllByText("Celaya")).toHaveLength(2)
})

it("persists region changes and Clear filters without clearing sorting, category, checkout or buyer geography", () => {
  const params = new URLSearchParams("filter=digital_asset&subtype=course&sort=newest&city=Celaya&country=Mexico&ownerSiteId=buyer&minPrice=10&priceCurrency=USD&nearMe=true")
  jest.mocked(useSearchParams).mockReturnValue(params as ReturnType<typeof useSearchParams>)
  const replace = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>)
  jest.mocked(useMarketplaceProducts).mockReturnValue({
    items: initial, count: 17, regions: [{ country: "united states", label: "United States", count: 12 }],
    isLoading: false, totalPages: 1, page: 1, setPage: jest.fn(), retry: jest.fn(), error: undefined,
  })
  const { container, rerender } = render(<MarketplaceClient initialItems={initial} initialCount={30} initialTotalPages={2} />)
  const sidebar = container.querySelector("aside")!
  const subtypes = within(sidebar).getByRole("heading", { name: "Subtypes" })
  const filters = within(sidebar).getByRole("region", { name: "Product filters" })
  expect(subtypes.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByTestId("product-list")).toHaveAttribute("data-count", "17")
  expect(screen.getByTestId("product-list")).toHaveAttribute("data-global-count", "30")
  fireEvent.click(within(sidebar).getByRole("radio", { name: "United States" }))
  const regionUrl = new URL(replace.mock.calls[0][0], "http://localhost")
  expect(regionUrl.searchParams.get("regionCountry")).toBe("united states")
  expect(regionUrl.searchParams.has("nearMe")).toBe(false)
  expect(regionUrl.searchParams.get("country")).toBe("Mexico")
  expect(regionUrl.searchParams.get("sort")).toBe("newest")
  jest.mocked(useSearchParams).mockReturnValue(regionUrl.searchParams as ReturnType<typeof useSearchParams>)
  rerender(<MarketplaceClient initialItems={initial} initialCount={30} initialTotalPages={2} />)
  fireEvent.click(within(sidebar).getByRole("button", { name: "Clear filters" }))
  expect(Object.fromEntries(new URL(replace.mock.calls[1][0], "http://localhost").searchParams)).toEqual({
    filter: "digital_asset", subtype: "course", sort: "newest", city: "Celaya", country: "Mexico", ownerSiteId: "buyer",
  })
})

it("replaces stale product results with a visible error and retry action", () => {
  const retry = jest.fn()
  jest.mocked(useMarketplaceProducts).mockReturnValue({ items: initial, count: 0, regions: [], isLoading: false,
    totalPages: 0, page: 1, setPage: jest.fn(), error: "Could not load marketplace products.", retry })
  render(<MarketplaceCatalog {...catalogProps} />)
  expect(screen.queryByTestId("product-list")).not.toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load marketplace products")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it.each(["populated", "empty", "loading", "error"])(
  "keeps the sticky sidebar in document flow for a %s catalog", (state) => {
    jest.mocked(useMarketplaceProducts).mockReturnValue({
      items: state === "populated" ? initial : [], count: state === "populated" ? 30 : 0,
      regions: [], isLoading: state === "loading", totalPages: 0, page: 1,
      setPage: jest.fn(), retry: jest.fn(), error: state === "error" ? "Could not load marketplace products." : undefined,
    })
    render(<MarketplaceClient initialItems={initial} initialCount={30} initialTotalPages={2} />)
    const sidebar = screen.getByRole("complementary")
    expect(within(sidebar).getByLabelText("Min price")).toBeInTheDocument()
    expect(within(sidebar).getByRole("checkbox", { name: "Available now" })).toBeInTheDocument()
    expect(within(sidebar).getByRole("button", { name: "Clear filters" })).toBeInTheDocument()
    expect(sidebar).toHaveClass("hidden", "md:block", "md:w-64", "shrink-0", "md:sticky", "md:top-24")
    expect(sidebar).toHaveClass("md:max-h-[calc(100dvh-7rem)]", "md:overflow-y-auto")
    expect(sidebar.className).not.toMatch(/(?:^|\s)(?:\S+:)?(?:fixed|absolute|overflow(?:-[xy])?-(?:hidden|clip))(?:\s|$)/)
    const row = sidebar.parentElement!
    expect(row).toHaveClass("flex", "md:flex-row", "gap-8", "items-start")
    expect(sidebar.nextElementSibling).toHaveClass("flex-1", "min-w-0")
    // Only the sidebar scrolls; its ancestors must not trap sticky positioning or clip the catalog.
    let element: HTMLElement | null = row
    while (element && element !== document.body) {
      expect(element.className).not.toMatch(/(?:^|\s)(?:\S+:)?(?:overflow(?:-[xy])?-(?:hidden|clip|auto|scroll)|max-h-\S+|h-(?:screen|full)|sticky|fixed|absolute)(?:\s|$)/)
      element = element.parentElement
    }
    const main = screen.getByRole("main")
    expect(main).toContainElement(sidebar)
    expect(main.compareDocumentPosition(screen.getByRole("contentinfo")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  },
)

it.each(["discounts", "digital_asset"])("keeps %s categories in the same sticky column", (kind) => {
  render(<MarketplaceCatalog {...catalogProps} selectedKind={kind} effectiveKind={kind} />)
  const sidebar = screen.getByRole("complementary")
  expect(sidebar).toHaveClass("md:sticky", "md:w-64", "shrink-0", "md:overflow-y-auto")
  expect(within(sidebar).getByRole("heading", { name: "Categories" })).toBeInTheDocument()
  if (kind === "digital_asset") {
    expect(within(sidebar).getByRole("heading", { name: "Subtypes" })).toBeInTheDocument()
    expect(within(sidebar).getByRole("button", { name: "Clear filters" })).toBeInTheDocument()
  } else {
    expect(within(sidebar).queryByRole("region", { name: "Product filters" })).not.toBeInTheDocument()
  }
})

it("keeps rapid price and availability changes together before router navigation commits", () => {
  const replace = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>)
  const { container } = render(<MarketplaceClient initialItems={initial} initialCount={30} initialTotalPages={2} />)
  const sidebar = container.querySelector("aside")!
  fireEvent.change(within(sidebar).getByLabelText("Min price"), { target: { value: "10" } })
  fireEvent.click(within(sidebar).getByRole("button", { name: "Apply" }))
  fireEvent.click(within(sidebar).getByRole("checkbox", { name: "Available now" }))
  expect(within(sidebar).getByRole("checkbox", { name: "Available now" })).toBeChecked()
  expect(Object.fromEntries(new URL(replace.mock.calls[1][0], "http://localhost").searchParams)).toEqual({
    minPrice: "10", priceCurrency: "USD", availableOnly: "true",
  })
  expect(useMarketplaceProducts).toHaveBeenLastCalledWith(initial, 2, "", "all", "all", false, "featured",
    location.effectiveBuyerGeo, { minPrice: 10, priceCurrency: "USD", availableOnly: true }, undefined, 30, undefined)
})