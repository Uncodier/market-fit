import {
  filterMarketplaceGeography, filterMarketplacePrices, marketplaceCountry, marketplaceRegions,
} from "@/app/marketplace/marketplace-product-filters"
import { parseMarketplaceProductsRequest } from "@/app/marketplace/marketplace-products-request"

const items = [
  { id: "mx1", site_id: "mx", created_at: "2026-10-01", target_sale_price: 100, currency: "MXN" },
  { id: "mx2", site_id: "mx", created_at: "2026-10-01", target_sale_price: 200, currency: "MXN" },
  { id: "us", site_id: "us", created_at: "2026-10-01", target_sale_price: 10, currency: "USD" },
  { id: "unknown", site_id: "unknown", created_at: "2026-10-01", target_sale_price: null, currency: "USD" },
]
const areas = new Map([
  ["mx", [{ city: "León", country: "MX" }, { city: "Leon", country: "Mexico" }]],
  ["us", [{ city: "Leon", country: "US" }]],
  ["unknown", [{ country: "Country name" }]],
])

describe("marketplace listing filters", () => {
  it("normalizes country codes/localized names, excludes placeholders and inferred text", () => {
    for (const name of ["MX", "Mexico", "México", "mexico"]) {
      expect(marketplaceCountry(name)).toEqual({ country: "mexico", label: "Mexico" })
    }
    expect(marketplaceCountry("Polonia")).toEqual({ country: "poland", label: "Poland" })
    expect(marketplaceCountry("US")).toEqual({ country: "united states", label: "United States" })
    expect(marketplaceCountry("Country name")).toBeNull()
    expect(marketplaceCountry("Mexico (inferred)")).toBeNull()
    expect(marketplaceCountry("ZZ")).toBeNull()
  })
  it("counts each listing once per country and sorts by product counts", () => {
    expect(marketplaceRegions(items, areas)).toEqual([
      { country: "mexico", label: "Mexico", count: 2 },
      { country: "united states", label: "United States", count: 1 },
    ])
  })
  it("filters countries before pagination independently of buyer geography", () => {
    expect(filterMarketplaceGeography(items, { regionCountry: "MX" }, areas, { country: "US" }).map(item => item.id)).toEqual(["mx1", "mx2"])
    expect(filterMarketplaceGeography(items, { nearMe: true }, areas, { city: "Leon", country: "Mexico" }).map(item => item.id)).toEqual(["mx1", "mx2"])
    expect(filterMarketplaceGeography(items, { nearMe: true }, areas, { city: "Other", country: "Mexico" })).toEqual([])
    expect(filterMarketplaceGeography(items, { nearMe: true }, areas)).toEqual([])
    expect(filterMarketplaceGeography(items, {}, areas)).toBe(items)
  })
  it("filters marketplace prices in the requested currency with inclusive range bounds", () => {
    expect(filterMarketplacePrices(items, { minPrice: 100, maxPrice: 200, priceCurrency: "MXN" }, { MXN: 20 }).map(item => item.id)).toEqual(["mx1", "mx2", "us"])
    expect(filterMarketplacePrices(items, { minPrice: 6, maxPrice: 10, priceCurrency: "USD" }, { MXN: 20 }).map(item => item.id)).toEqual(["mx2", "us"])
    expect(filterMarketplacePrices(items, { maxPrice: 200, priceCurrency: "MXN" }, {}).map(item => item.id)).toEqual(["mx1", "mx2"])
    expect(filterMarketplacePrices(items, {}, {})).toBe(items)
  })
  it.each(["minPrice=-1", "maxPrice=bad", "minPrice=11&maxPrice=10", "priceCurrency=badcode", "availableOnly=yes", "nearMe=yes", "nearMe=true&regionCountry=Mexico", "regionCountry=Country+name"])("validates %s", query => {
    expect(parseMarketplaceProductsRequest(new URLSearchParams(query))).toBeNull()
  })
  it("parses real filters and retains location as an independent ranking preference", () => {
    expect(parseMarketplaceProductsRequest(new URLSearchParams("regionCountry=Mexico&country=US&availableOnly=true&minPrice=0&maxPrice=100&priceCurrency=mxn")))
      .toMatchObject({ regionCountry: "Mexico", availableOnly: true, nearMe: false, minPrice: 0, maxPrice: 100, priceCurrency: "MXN", buyerGeo: { country: "US" } })
  })
})